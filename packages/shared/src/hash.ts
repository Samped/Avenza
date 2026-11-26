import { createHash } from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function paymentCommitment(parts: {
  organizationId: string;
  /** Invoice id, direct payout id, or batch line reference */
  referenceId: string;
  amountMinor: string;
  currency: string;
  supplierId: string;
  destinationAddress: string;
  tokenAddress: string;
  chainId: number;
  policyVersion: number;
}): string {
  const payload = [
    parts.organizationId,
    parts.referenceId,
    parts.amountMinor,
    parts.currency,
    parts.supplierId,
    parts.destinationAddress.toLowerCase(),
    parts.tokenAddress.toLowerCase(),
    String(parts.chainId),
    String(parts.policyVersion),
  ].join("|");
  return sha256Hex(payload);
}

export function chainAuditHash(previousHash: string, payload: unknown): string {
  return sha256Hex(`${previousHash}|${JSON.stringify(payload)}`);
}
