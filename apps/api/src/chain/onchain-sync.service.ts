import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  auditRegistryAbi,
  controlsRegistryAbi,
  createXLayerPublicClient,
  createXLayerWalletClient,
  organizationRegistryAbi,
  paymentPolicyRegistryAbi,
  vendorRegistryAbi,
  type Hex,
} from "@avenza/chain";
import type { ControlsRules } from "@avenza/shared";

function toBytes32(hexOrId: string): `0x${string}` {
  if (hexOrId.startsWith("0x") && hexOrId.length === 66) return hexOrId as `0x${string}`;
  return `0x${createHash("sha256").update(hexOrId).digest("hex")}`;
}

/**
 * Best-effort sync of off-chain business events onto X Layer registries.
 * Failures are logged and swallowed so the AP workflow stays usable when RPC is down;
 * settlement still enforces contracts when on-chain mode is active.
 */
@Injectable()
export class OnchainSyncService {
  private readonly log = new Logger(OnchainSyncService.name);

  /**
   * Registry mutations are Ownable — use REGISTRY_OWNER_PRIVATE_KEY (or deployer).
   * Settlement still uses RELAYER_PRIVATE_KEY in payments/settlement.ts.
   */
  private client() {
    const pk = (process.env.REGISTRY_OWNER_PRIVATE_KEY ||
      process.env.OWNER_PRIVATE_KEY ||
      process.env.DEPLOYER_PRIVATE_KEY ||
      process.env.RELAYER_PRIVATE_KEY) as Hex | undefined;
    if (!pk) return null;
    const chainId = Number(process.env.XLAYER_CHAIN_ID || 196);
    const rpc = process.env.XLAYER_RPC_URL;
    const wallet = createXLayerWalletClient(chainId, pk, rpc);
    const publicClient = createXLayerPublicClient(chainId, rpc);
    if (!wallet.account) return null;
    return { wallet, publicClient, account: wallet.account, chainId };
  }

  async ensureOrganization(onChainOrgId: string, policyRef = "default") {
    const orgRegistry = process.env.ORGANIZATION_REGISTRY_ADDRESS as `0x${string}` | undefined;
    const ctx = this.client();
    if (!orgRegistry || !ctx) return { ok: false as const, reason: "not_configured" };
    try {
      const id = toBytes32(onChainOrgId);
      const active = await ctx.publicClient.readContract({
        address: orgRegistry,
        abi: organizationRegistryAbi,
        functionName: "isActive",
        args: [id],
      });
      if (active) return { ok: true as const, already: true };
      const hash = await ctx.wallet.writeContract({
        address: orgRegistry,
        abi: organizationRegistryAbi,
        functionName: "register",
        args: [id, ctx.account.address, toBytes32(policyRef)],
      });
      await ctx.publicClient.waitForTransactionReceipt({ hash });
      return { ok: true as const, hash };
    } catch (e) {
      this.log.warn(`ensureOrganization failed: ${(e as Error).message}`);
      return { ok: false as const, reason: (e as Error).message };
    }
  }

  async syncVendor(input: {
    onChainOrgId: string;
    supplierId: string;
    destination: `0x${string}`;
    verified: boolean;
  }) {
    const vendorRegistry = process.env.VENDOR_REGISTRY_ADDRESS as `0x${string}` | undefined;
    const ctx = this.client();
    if (!vendorRegistry || !ctx) return { ok: false as const, reason: "not_configured" };
    try {
      await this.ensureOrganization(input.onChainOrgId);
      const orgId = toBytes32(input.onChainOrgId);
      const vendorId = toBytes32(input.supplierId);
      const existing = await ctx.publicClient.readContract({
        address: vendorRegistry,
        abi: vendorRegistryAbi,
        functionName: "vendors",
        args: [vendorId],
      });
      const exists = existing[0] !== "0x0000000000000000000000000000000000000000000000000000000000000000";
      if (!exists) {
        const hash = await ctx.wallet.writeContract({
          address: vendorRegistry,
          abi: vendorRegistryAbi,
          functionName: "registerVendor",
          args: [orgId, vendorId, input.destination],
        });
        await ctx.publicClient.waitForTransactionReceipt({ hash });
      } else if (existing[3].toLowerCase() !== input.destination.toLowerCase()) {
        const hash = await ctx.wallet.writeContract({
          address: vendorRegistry,
          abi: vendorRegistryAbi,
          functionName: "setDestination",
          args: [vendorId, input.destination],
        });
        await ctx.publicClient.waitForTransactionReceipt({ hash });
      }
      if (input.verified) {
        const hash = await ctx.wallet.writeContract({
          address: vendorRegistry,
          abi: vendorRegistryAbi,
          functionName: "setVerified",
          args: [vendorId, true],
        });
        await ctx.publicClient.waitForTransactionReceipt({ hash });
      }
      return { ok: true as const };
    } catch (e) {
      this.log.warn(`syncVendor failed: ${(e as Error).message}`);
      return { ok: false as const, reason: (e as Error).message };
    }
  }

  async syncPaymentPolicy(input: {
    onChainOrgId: string;
    policyName: string;
    processor: `0x${string}`;
    circuitId: bigint;
    configHash: string;
  }) {
    const registry = process.env.PAYMENT_POLICY_REGISTRY_ADDRESS as `0x${string}` | undefined;
    const ctx = this.client();
    if (!registry || !ctx) return { ok: false as const, reason: "not_configured" };
    try {
      await this.ensureOrganization(input.onChainOrgId);
      const hash = await ctx.wallet.writeContract({
        address: registry,
        abi: paymentPolicyRegistryAbi,
        functionName: "registerPolicy",
        args: [
          toBytes32(input.onChainOrgId),
          input.policyName,
          input.processor,
          input.circuitId,
          toBytes32(input.configHash),
        ],
      });
      await ctx.publicClient.waitForTransactionReceipt({ hash });
      return { ok: true as const, hash };
    } catch (e) {
      this.log.warn(`syncPaymentPolicy failed: ${(e as Error).message}`);
      return { ok: false as const, reason: (e as Error).message };
    }
  }

  async syncControls(input: {
    onChainOrgId: string;
    rules: ControlsRules;
    configHash: string;
  }) {
    const registry = process.env.CONTROLS_REGISTRY_ADDRESS as `0x${string}` | undefined;
    const ctx = this.client();
    if (!registry || !ctx) return { ok: false as const, reason: "not_configured" };
    try {
      await this.ensureOrganization(input.onChainOrgId);
      const toMinor = (major: number) => BigInt(Math.round(major * 1e6));
      const hash = await ctx.wallet.writeContract({
        address: registry,
        abi: controlsRegistryAbi,
        functionName: "publishControls",
        args: [
          toBytes32(input.onChainOrgId),
          toMinor(input.rules.autoApproveMaxUsdc),
          toMinor(input.rules.singleApproverMaxUsdc),
          toMinor(input.rules.dualControlAboveUsdc),
          input.rules.minConfidenceBps,
          input.rules.holdOnNewVendor,
          input.rules.holdOnDestinationChange,
          input.rules.holdOnDuplicate,
          input.rules.requirePurchaseOrder,
          input.rules.requirePoMatch,
          input.rules.holdOnUnknownDestination,
          input.rules.blockAutoApproveUntilAllowlisted,
          toBytes32(input.configHash),
        ],
      });
      await ctx.publicClient.waitForTransactionReceipt({ hash });
      let version = 0;
      try {
        const latest = await ctx.publicClient.readContract({
          address: registry,
          abi: controlsRegistryAbi,
          functionName: "latestVersion",
          args: [toBytes32(input.onChainOrgId)],
        });
        version = Number(latest);
      } catch {
        /* ignore */
      }
      return { ok: true as const, hash, version };
    } catch (e) {
      this.log.warn(`syncControls failed: ${(e as Error).message}`);
      return { ok: false as const, reason: (e as Error).message };
    }
  }

  /** eventType: 1=authorized 2=settled 3=completed 4=failed */
  async commitAudit(input: {
    onChainOrgId: string;
    recordKey: string;
    invoiceCommitment?: string;
    paymentId?: string;
    policyVersion?: number;
    authorizationRef?: string;
    settlementRef?: string;
    eventType: number;
  }) {
    const registry = process.env.AUDIT_REGISTRY_ADDRESS as `0x${string}` | undefined;
    const ctx = this.client();
    if (!registry || !ctx) return { ok: false as const, reason: "not_configured" };
    try {
      const zero = ("0x" + "0".repeat(64)) as `0x${string}`;
      const hash = await ctx.wallet.writeContract({
        address: registry,
        abi: auditRegistryAbi,
        functionName: "commit",
        args: [
          toBytes32(input.recordKey),
          toBytes32(input.onChainOrgId),
          input.invoiceCommitment ? toBytes32(input.invoiceCommitment) : zero,
          input.paymentId ? toBytes32(input.paymentId) : zero,
          BigInt(input.policyVersion || 0),
          input.authorizationRef ? toBytes32(input.authorizationRef) : zero,
          input.settlementRef ? toBytes32(input.settlementRef) : zero,
          input.eventType,
        ],
      });
      await ctx.publicClient.waitForTransactionReceipt({ hash });
      return { ok: true as const, hash };
    } catch (e) {
      this.log.warn(`commitAudit failed: ${(e as Error).message}`);
      return { ok: false as const, reason: (e as Error).message };
    }
  }
}
