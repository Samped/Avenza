import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_CONTROLS_RULES,
  PublishControlsSchema,
  evaluateControls,
  sha256Hex,
  type ControlsRules,
  type RiskFlags,
} from "@avenza/shared";
import {
  controlsRegistryAbi,
  createXLayerPublicClient,
} from "@avenza/chain";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { OnchainSyncService } from "../chain/onchain-sync.service";

function toBytes32(hexOrId: string): `0x${string}` {
  if (hexOrId.startsWith("0x") && hexOrId.length === 66) return hexOrId as `0x${string}`;
  return `0x${createHash("sha256").update(hexOrId).digest("hex")}`;
}

@Injectable()
export class ControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly onchain: OnchainSyncService,
  ) {}

  async getActive(orgId: string) {
    const row = await this.prisma.controlsPublication.findFirst({
      where: { organizationId: orgId, active: true },
      orderBy: { version: "desc" },
    });
    if (!row) {
      return {
        version: 0,
        rules: DEFAULT_CONTROLS_RULES,
        configHash: null,
        onChainTxHash: null,
        onChainVersion: null,
        source: "default" as const,
      };
    }
    return {
      version: row.version,
      rules: JSON.parse(row.rulesJson) as ControlsRules,
      configHash: row.configHash,
      onChainTxHash: row.onChainTxHash,
      onChainVersion: row.onChainVersion,
      source: "published" as const,
    };
  }

  async publish(orgId: string, actorId: string, body: unknown) {
    const parsed = PublishControlsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const rules: ControlsRules = {
      autoApproveMaxUsdc: parsed.data.autoApproveMaxUsdc,
      singleApproverMaxUsdc: parsed.data.singleApproverMaxUsdc,
      dualControlAboveUsdc: parsed.data.dualControlAboveUsdc,
      minConfidenceBps: parsed.data.minConfidenceBps,
      holdOnNewVendor: parsed.data.holdOnNewVendor,
      holdOnDestinationChange: parsed.data.holdOnDestinationChange,
      holdOnDuplicate: parsed.data.holdOnDuplicate,
      requirePurchaseOrder: parsed.data.requirePurchaseOrder,
      requirePoMatch: parsed.data.requirePoMatch,
      holdOnUnknownDestination: parsed.data.holdOnUnknownDestination,
      blockAutoApproveUntilAllowlisted: parsed.data.blockAutoApproveUntilAllowlisted,
    };
    if (rules.dualControlAboveUsdc < rules.singleApproverMaxUsdc) {
      throw new BadRequestException("dualControlAboveUsdc must be >= singleApproverMaxUsdc");
    }

    const latest = await this.prisma.controlsPublication.findFirst({
      where: { organizationId: orgId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    const configHash = sha256Hex(JSON.stringify({ ...rules, version }));

    await this.prisma.controlsPublication.updateMany({
      where: { organizationId: orgId, active: true },
      data: { active: false },
    });

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const sync = await this.onchain.syncControls({
      onChainOrgId: org.onChainOrgId || org.id,
      rules,
      configHash,
    });

    const row = await this.prisma.controlsPublication.create({
      data: {
        organizationId: orgId,
        version,
        rulesJson: JSON.stringify(rules),
        configHash,
        onChainTxHash: sync.ok ? sync.hash : null,
        onChainVersion: sync.ok ? sync.version || version : null,
        active: true,
      },
    });

    // Also keep ApprovalPolicy in sync for UI / requiredApprovals fallback.
    let policy = await this.prisma.approvalPolicy.findFirst({
      where: { organizationId: orgId, active: true },
    });
    if (!policy) {
      policy = await this.prisma.approvalPolicy.create({
        data: { organizationId: orgId, name: parsed.data.name, active: true },
      });
    } else {
      await this.prisma.approvalPolicy.update({
        where: { id: policy.id },
        data: { name: parsed.data.name },
      });
    }
    const lastAp = await this.prisma.approvalPolicyVersion.findFirst({
      where: { policyId: policy.id },
      orderBy: { version: "desc" },
    });
    await this.prisma.approvalPolicyVersion.create({
      data: {
        policyId: policy.id,
        version: (lastAp?.version ?? 0) + 1,
        rulesJson: JSON.stringify(rules),
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "controls.published",
      entityType: "controls_publication",
      entityId: row.id,
      eventPayload: {
        version,
        configHash,
        onChain: sync.ok,
        onChainTxHash: sync.ok ? sync.hash : null,
        reason: sync.ok ? undefined : sync.reason,
      },
    });

    return { publication: row, onChain: sync, rules };
  }

  listHistory(orgId: string) {
    return this.prisma.controlsPublication.findMany({
      where: { organizationId: orgId },
      orderBy: { version: "desc" },
      take: 25,
      select: {
        id: true,
        version: true,
        rulesJson: true,
        configHash: true,
        onChainTxHash: true,
        onChainVersion: true,
        active: true,
        createdAt: true,
      },
    });
  }

  /**
   * Prefer live ControlsRegistry.evaluate when configured; fall back to local mirror.
   */
  async evaluate(orgId: string, amountMinor: bigint, flags: RiskFlags) {
    const active = await this.getActive(orgId);
    const amountUsdc = Number(amountMinor) / 1e6;
    const local = evaluateControls({ amountUsdc, flags, rules: active.rules });

    const registry = process.env.CONTROLS_REGISTRY_ADDRESS as `0x${string}` | undefined;
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!registry || !org) {
      return { ...local, controlsVersion: active.version, source: "local" as const };
    }

    try {
      const chainId = Number(process.env.XLAYER_CHAIN_ID || 1952);
      const client = createXLayerPublicClient(chainId, process.env.XLAYER_RPC_URL);
      const onChainOrgId = org.onChainOrgId || org.id;
      const latest = await client.readContract({
        address: registry,
        abi: controlsRegistryAbi,
        functionName: "latestVersion",
        args: [toBytes32(onChainOrgId)],
      });
      if (Number(latest) === 0) {
        return { ...local, controlsVersion: active.version, source: "local" as const };
      }
      const result = await client.readContract({
        address: registry,
        abi: controlsRegistryAbi,
        functionName: "evaluate",
        args: [
          toBytes32(onChainOrgId),
          amountMinor,
          {
            isNewVendor: flags.isNewVendor,
            destinationChanged: flags.destinationChanged,
            isDuplicate: flags.isDuplicate,
            missingPo: flags.missingPo,
            poMismatch: flags.poMismatch,
            unknownDestination: flags.unknownDestination,
            supplierBlocked: flags.supplierBlocked,
            confidenceBps: flags.confidenceBps,
          },
        ],
      });
      const decisionMap = ["auto_approve", "single_approval", "dual_control", "hold"] as const;
      const decision = decisionMap[Number(result.decision)] ?? "hold";
      return {
        decision,
        requiredApprovals: Number(result.requiredApprovals),
        reasonCode: local.reasonCode,
        nextStatus:
          decision === "hold"
            ? ("ON_HOLD" as const)
            : decision === "auto_approve"
              ? ("APPROVED" as const)
              : ("AWAITING_APPROVAL" as const),
        controlsVersion: Number(latest),
        source: "onchain" as const,
        reasonCodeOnChain: result.reasonCode,
      };
    } catch {
      return { ...local, controlsVersion: active.version, source: "local" as const };
    }
  }

  async releaseHold(orgId: string, invoiceId: string, actorId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
    });
    if (!invoice) throw new NotFoundException();
    if (invoice.status !== "ON_HOLD") {
      throw new BadRequestException("Invoice is not on hold");
    }
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "VERIFIED", holdReason: null },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "controls.hold_released",
      entityType: "invoice",
      entityId: invoiceId,
      eventPayload: {},
    });
    return this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  }
}
