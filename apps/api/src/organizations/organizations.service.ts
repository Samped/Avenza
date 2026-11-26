import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CreateOrganizationSchema, InviteMemberSchema } from "@avenza/shared";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { provisionOrgWallet } from "../treasury/org-wallet";
import { OnchainSyncService } from "../chain/onchain-sync.service";
import {
  revealOrg,
  sealEmail,
  sealRegistration,
} from "../crypto/sensitive-fields";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly onchain: OnchainSyncService,
  ) {}

  async create(userId: string, body: unknown) {
    const parsed = CreateOrganizationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const onChainOrgId = `0x${createHash("sha256").update(`${userId}:${parsed.data.legalName}:${Date.now()}`).digest("hex")}`;
    const wallet = provisionOrgWallet();

    const org = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          legalName: parsed.data.legalName,
          registrationNumber: sealRegistration(parsed.data.registrationNumber) ?? null,
          country: parsed.data.country,
          businessEmail: sealEmail(parsed.data.businessEmail) ?? null,
          onChainOrgId,
        },
      });
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId,
          role: "admin",
        },
      });
      await tx.treasuryConfig.create({
        data: {
          organizationId: organization.id,
          onChainOrgId,
          vaultAddress: wallet.vaultAddress,
          fundingWalletAddress: wallet.fundingWalletAddress,
          fundingWalletKeyEnc: wallet.fundingWalletKeyEnc,
          chainId: wallet.chainId,
        },
      });
      await tx.approvalPolicy.create({
        data: {
          organizationId: organization.id,
          name: "Default",
          versions: {
            create: {
              version: 1,
              rulesJson: JSON.stringify([
                { minAmount: "0", maxAmount: "500000000", requiredApprovals: 1 },
                { minAmount: "500000000", maxAmount: "5000000000", requiredApprovals: 2 },
                { minAmount: "5000000000", maxAmount: null, requiredApprovals: 2, requireNewSupplierExtra: true },
              ]),
            },
          },
        },
      });
      await tx.paymentPolicy.create({
        data: {
          organizationId: organization.id,
          policyName: "Default spend",
          version: 1,
          policyHash: createHash("sha256").update("default-v1").digest("hex"),
          dailySpendLimitMinor: "100000000000",
          perPaymentLimitMinor: "25000000000",
        },
      });
      return organization;
    });

    await this.audit.record({
      organizationId: org.id,
      actorId: userId,
      eventType: "organization.created",
      entityType: "organization",
      entityId: org.id,
      eventPayload: {
        legalName: org.legalName,
        fundingWalletAddress: wallet.fundingWalletAddress,
        vaultAddress: wallet.vaultAddress,
        onChainOrgId,
      },
    });

    // Best-effort: activate org on OrganizationRegistry for settlement.
    void this.onchain.ensureOrganization(onChainOrgId, "default");

    return this.get(org.id);
  }

  async get(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { treasuryConfig: true },
    });
    if (!org) throw new NotFoundException();

    // Backfill wallets for workspaces created before per-org funding wallets.
    if (!org.treasuryConfig?.fundingWalletAddress) {
      const wallet = provisionOrgWallet();
      const treasuryConfig = org.treasuryConfig
        ? await this.prisma.treasuryConfig.update({
            where: { id: org.treasuryConfig.id },
            data: {
              fundingWalletAddress: wallet.fundingWalletAddress,
              fundingWalletKeyEnc: wallet.fundingWalletKeyEnc,
              vaultAddress: org.treasuryConfig.vaultAddress || wallet.vaultAddress,
              chainId: org.treasuryConfig.chainId || wallet.chainId,
              onChainOrgId: org.treasuryConfig.onChainOrgId || org.onChainOrgId,
            },
          })
        : await this.prisma.treasuryConfig.create({
            data: {
              organizationId: orgId,
              onChainOrgId: org.onChainOrgId,
              ...wallet,
            },
          });
      return revealOrg({ ...org, treasuryConfig });
    }

    return revealOrg(org);
  }

  async update(
    orgId: string,
    body: {
      legalName?: string;
      country?: string;
      businessEmail?: string;
      registrationNumber?: string;
    },
  ) {
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        legalName: body.legalName,
        country: body.country,
        businessEmail:
          body.businessEmail !== undefined
            ? (sealEmail(body.businessEmail) ?? null)
            : undefined,
        registrationNumber:
          body.registrationNumber !== undefined
            ? (sealRegistration(body.registrationNumber) ?? null)
            : undefined,
      },
    });
    return revealOrg(updated);
  }

  async listMembers(orgId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
  }

  async inviteMember(orgId: string, actorId: string, body: unknown) {
    const parsed = InviteMemberSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    let user = await this.prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user) {
      const passwordHash = await import("bcryptjs").then((b) =>
        b.hash(`Invite-${Date.now()}-${Math.random()}`, 12),
      );
      user = await this.prisma.user.create({
        data: {
          email: parsed.data.email.toLowerCase(),
          fullName: parsed.data.fullName || parsed.data.email,
          passwordHash,
          accountStatus: "invited",
        },
      });
    }

    const member = await this.prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: orgId, userId: user.id },
      },
      create: {
        organizationId: orgId,
        userId: user.id,
        role: parsed.data.role,
        status: "active",
      },
      update: { role: parsed.data.role, status: "active" },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "member.invited",
      entityType: "member",
      entityId: member.id,
      eventPayload: { email: user.email, role: parsed.data.role },
    });

    return { member, user: { id: user.id, email: user.email, fullName: user.fullName } };
  }
}
