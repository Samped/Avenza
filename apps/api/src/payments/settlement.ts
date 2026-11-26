import { createHash } from "node:crypto";
import {
  businessTreasuryAbi,
  controlsRegistryAbi,
  createXLayerPublicClient,
  createXLayerWalletClient,
  organizationRegistryAbi,
  paymentAuthorizationAbi,
  paymentPolicyRegistryAbi,
  assertNativeUsdc,
  type Hex,
} from "@avenza/chain";
import type { RiskFlags } from "@avenza/shared";

export type SettlementRequest = {
  organizationOnChainId: string;
  paymentId: string;
  invoiceCommitment: string;
  policyVersion: number;
  controlsVersion?: number;
  amountMinor: bigint;
  tokenAddress: `0x${string}`;
  destination: `0x${string}`;
  approvalCount: number;
  requiredApprovals: number;
  circuitResult: `0x${string}`;
  vendorEligible: boolean;
  /** Supplier id hashed to bytes32 for VendorRegistry.isEligible */
  vendorId: string;
  /** LSB-packed TapeOut inputs verified on-chain against the policy processor. */
  circuitInputs: `0x${string}`;
  risk: RiskFlags;
  /**
   * When set, skip authorize and only call executeAuthorizedPayment
   * (authorize already succeeded; paymentSeen is set on-chain).
   */
  existingAuthorizationId?: string;
};

export type SettlementResult = {
  mode: "onchain";
  authorizationId: string;
  authorizationTxHash: string;
  transactionHash: string;
  policyVersion: number;
  controlsVersion: number;
  chainId: number;
};

export class SettlementError extends Error {
  constructor(
    message: string,
    readonly partial?: {
      authorizationId?: string;
      authorizationTxHash?: string;
      policyVersion?: number;
      chainId?: number;
    },
  ) {
    super(message);
    this.name = "SettlementError";
  }
}

function toBytes32(hexOrId: string): `0x${string}` {
  if (hexOrId.startsWith("0x") && hexOrId.length === 66) return hexOrId as `0x${string}`;
  const h = createHash("sha256").update(hexOrId).digest("hex");
  return `0x${h}`;
}

function requireRelayerEnv() {
  const chainId = Number(process.env.XLAYER_CHAIN_ID || 1952);
  const authAddr = process.env.PAYMENT_AUTHORIZATION_ADDRESS as `0x${string}` | undefined;
  const treasuryAddr = process.env.TREASURY_ADDRESS as `0x${string}` | undefined;
  const pk = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
  const rpc = process.env.XLAYER_RPC_URL;
  if (!authAddr || !treasuryAddr || !pk) {
    throw new SettlementError(
      "On-chain settlement required: set PAYMENT_AUTHORIZATION_ADDRESS, TREASURY_ADDRESS, and RELAYER_PRIVATE_KEY.",
    );
  }
  return { chainId, authAddr, treasuryAddr, pk, rpc };
}

/**
 * Live X Layer settlement only:
 * 1) PaymentAuthorization.authorize (on-chain TapeOut re-eval + VendorRegistry)
 * 2) BusinessTreasury.executeAuthorizedPayment (native USDC)
 *
 * If `existingAuthorizationId` is set, step 1 is skipped (retry after authorize-success / execute-fail).
 */
export async function executeSettlement(req: SettlementRequest): Promise<SettlementResult> {
  const { chainId, authAddr, treasuryAddr, pk, rpc } = requireRelayerEnv();
  assertNativeUsdc(chainId, req.tokenAddress);

  const wallet = createXLayerWalletClient(chainId, pk, rpc);
  const publicClient = createXLayerPublicClient(chainId, rpc);
  const account = wallet.account;
  if (!account) throw new SettlementError("Relayer wallet account missing");

  const orgId32 = toBytes32(req.organizationOnChainId);
  const paymentId32 = toBytes32(req.paymentId);
  const orgRegistry = process.env.ORGANIZATION_REGISTRY_ADDRESS as `0x${string}` | undefined;
  if (orgRegistry) {
    const active = await publicClient.readContract({
      address: orgRegistry,
      abi: organizationRegistryAbi,
      functionName: "isActive",
      args: [orgId32],
    });
    if (!active) {
      const regHash = await wallet.writeContract({
        address: orgRegistry,
        abi: organizationRegistryAbi,
        functionName: "register",
        args: [orgId32, account.address, toBytes32(`policy:${req.policyVersion}`)],
      });
      await publicClient.waitForTransactionReceipt({ hash: regHash });
    }
  }

  let policyVersion = req.policyVersion;
  const policyRegistry = process.env.PAYMENT_POLICY_REGISTRY_ADDRESS as `0x${string}` | undefined;
  if (policyRegistry) {
    try {
      const latest = await publicClient.readContract({
        address: policyRegistry,
        abi: paymentPolicyRegistryAbi,
        functionName: "latestVersion",
        args: [orgId32],
      });
      const n = Number(latest);
      if (n > 0) policyVersion = n;
    } catch {
      // keep off-chain version
    }
  }

  let controlsVersion = req.controlsVersion ?? 0;
  const controlsRegistry = process.env.CONTROLS_REGISTRY_ADDRESS as `0x${string}` | undefined;
  if (controlsRegistry) {
    try {
      const latest = await publicClient.readContract({
        address: controlsRegistry,
        abi: controlsRegistryAbi,
        functionName: "latestVersion",
        args: [orgId32],
      });
      const n = Number(latest);
      if (n > 0) controlsVersion = n;
    } catch {
      // keep supplied version
    }
  }

  let authorizationId = (req.existingAuthorizationId || "") as `0x${string}`;
  let authorizationTxHash = "0x" as `0x${string}`;

  if (!req.existingAuthorizationId) {
    const authArgs = {
      organizationId: orgId32,
      paymentId: paymentId32,
      invoiceCommitment: toBytes32(req.invoiceCommitment),
      policyVersion: BigInt(policyVersion),
      controlsVersion: BigInt(controlsVersion),
      amount: req.amountMinor,
      token: req.tokenAddress,
      destination: req.destination,
      vendorId: toBytes32(req.vendorId),
      vendorEligible: req.vendorEligible,
      approvalCount: req.approvalCount,
      requiredApprovals: req.requiredApprovals,
      circuitResult: req.circuitResult,
      circuitInputs: req.circuitInputs,
      risk: {
        isNewVendor: req.risk.isNewVendor,
        destinationChanged: req.risk.destinationChanged,
        isDuplicate: req.risk.isDuplicate,
        missingPo: req.risk.missingPo,
        poMismatch: req.risk.poMismatch,
        unknownDestination: req.risk.unknownDestination,
        supplierBlocked: req.risk.supplierBlocked,
        confidenceBps: req.risk.confidenceBps,
      },
    } as const;

    const { result: simulatedAuthId } = await publicClient.simulateContract({
      address: authAddr,
      abi: paymentAuthorizationAbi,
      functionName: "authorize",
      args: [authArgs],
      account,
    });
    authorizationId = simulatedAuthId;

    authorizationTxHash = await wallet.writeContract({
      address: authAddr,
      abi: paymentAuthorizationAbi,
      functionName: "authorize",
      args: [authArgs],
    });
    await publicClient.waitForTransactionReceipt({ hash: authorizationTxHash });
  } else {
    // Confirm on-chain auth still exists for this payment
    const onChainId = await publicClient.readContract({
      address: authAddr,
      abi: paymentAuthorizationAbi,
      functionName: "paymentAuthorizationId",
      args: [paymentId32],
    });
    if (
      !onChainId ||
      onChainId === "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      throw new SettlementError(
        "No on-chain authorization for this payment — cannot retry execute. Create a new payment only after cancelling this one.",
      );
    }
    authorizationId = onChainId as `0x${string}`;
    authorizationTxHash = "0x0" as `0x${string}`;
  }

  try {
    const transactionHash = await wallet.writeContract({
      address: treasuryAddr,
      abi: businessTreasuryAbi,
      functionName: "executeAuthorizedPayment",
      args: [
        orgId32,
        paymentId32,
        authorizationId,
        req.tokenAddress,
        req.destination,
        req.amountMinor,
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: transactionHash });

    return {
      mode: "onchain",
      authorizationId,
      authorizationTxHash,
      transactionHash,
      policyVersion,
      controlsVersion,
      chainId,
    };
  } catch (e) {
    throw new SettlementError(
      `${(e as Error).message} (authorize succeeded — fund the vault then retry settle on the same payment)`,
      {
        authorizationId,
        authorizationTxHash:
          authorizationTxHash !== "0x0" ? authorizationTxHash : undefined,
        policyVersion,
        chainId,
      },
    );
  }
}

export async function getConfirmations(txHash: `0x${string}`): Promise<number> {
  if (txHash.toLowerCase().startsWith("0xsim")) {
    throw new Error("Simulated settlement hashes are no longer accepted");
  }
  const chainId = Number(process.env.XLAYER_CHAIN_ID || 1952);
  const rpc = process.env.XLAYER_RPC_URL;
  const client = createXLayerPublicClient(chainId, rpc);
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (!receipt || receipt.status === "reverted") return 0;
  const head = await client.getBlockNumber();
  return Number(head - receipt.blockNumber) + 1;
}
