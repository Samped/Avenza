import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { assertNativeUsdc } from "@avenza/chain";
import { AddPaymentDestinationSchema, CreateSupplierSchema } from "@avenza/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { OnchainSyncService } from "../chain/onchain-sync.service";
import { revealSupplier, sealEmail, sealPhone } from "../crypto/sensitive-fields";

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly onchain: OnchainSyncService,
  ) {}

  async create(orgId: string, actorId: string, body: unknown) {
    const parsed = CreateSupplierSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const supplier = await this.prisma.supplier.create({
      data: {
        organizationId: orgId,
        legalName: parsed.data.legalName,
        supplierCode: parsed.data.supplierCode,
        contactEmail: sealEmail(parsed.data.contactEmail) ?? null,
        contactPhone: sealPhone(parsed.data.contactPhone) ?? null,
        payeeType: parsed.data.payeeType,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "supplier.created",
      entityType: "supplier",
      entityId: supplier.id,
      eventPayload: { legalName: supplier.legalName },
    });

    return revealSupplier(supplier);
  }

  async list(orgId: string) {
    const rows = await this.prisma.supplier.findMany({
      where: { organizationId: orgId },
      include: { paymentDestinations: { where: { active: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((s) => revealSupplier(s));
  }

  async get(orgId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId: orgId },
      include: { paymentDestinations: true },
    });
    if (!supplier) throw new NotFoundException();
    return revealSupplier(supplier);
  }

  async update(orgId: string, id: string, body: { legalName?: string; verificationStatus?: "pending" | "verified" | "rejected" | "needs_review"; riskStatus?: "clear" | "watch" | "blocked" }) {
    await this.get(orgId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: body,
    });
  }

  async addDestination(orgId: string, supplierId: string, actorId: string, body: unknown) {
    const supplier = await this.get(orgId, supplierId);
    const parsed = AddPaymentDestinationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    try {
      assertNativeUsdc(parsed.data.chainId, parsed.data.tokenAddress);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const latest = await this.prisma.supplierPaymentDestination.findFirst({
      where: { supplierId },
      orderBy: { version: "desc" },
    });

    await this.prisma.supplierPaymentDestination.updateMany({
      where: { supplierId, active: true },
      data: { active: false },
    });

    const destination = await this.prisma.supplierPaymentDestination.create({
      data: {
        supplierId,
        chainId: parsed.data.chainId,
        tokenAddress: parsed.data.tokenAddress.toLowerCase(),
        walletAddress: parsed.data.walletAddress.toLowerCase(),
        verificationStatus: "needs_review",
        version: (latest?.version ?? 0) + 1,
        active: true,
      },
    });

    // Destination change requires re-verification — bump supplier status
    await this.prisma.supplier.update({
      where: { id: supplier.id },
      data: { verificationStatus: "needs_review" },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "supplier.destination_changed",
      entityType: "supplier_destination",
      entityId: destination.id,
      eventPayload: {
        supplierId,
        walletAddress: destination.walletAddress,
        version: destination.version,
      },
    });

    return destination;
  }

  async approveDestination(orgId: string, supplierId: string, destinationId: string, actorId: string) {
    await this.get(orgId, supplierId);
    const dest = await this.prisma.supplierPaymentDestination.update({
      where: { id: destinationId },
      data: {
        verificationStatus: "verified",
        approvedAt: new Date(),
        approvedBy: actorId,
      },
    });
    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: { verificationStatus: "verified" },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "supplier.destination_approved",
      entityType: "supplier_destination",
      entityId: dest.id,
      eventPayload: { supplierId },
    });

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (org?.onChainOrgId) {
      void this.onchain.syncVendor({
        onChainOrgId: org.onChainOrgId,
        supplierId,
        destination: dest.walletAddress as `0x${string}`,
        verified: true,
      });
    }

    return dest;
  }
}
