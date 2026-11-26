/** Platform monetization: gas recovery + platform fee (USDC minor units, 6 decimals). */

export type FeeBreakdown = {
  paymentMinor: bigint;
  platformFeeMinor: bigint;
  gasRecoveryMinor: bigint;
  totalFeesMinor: bigint;
  totalDebitMinor: bigint;
  platformFeeBps: number;
  platformFeeFlatMinor: bigint;
  gasRecoveryFlatMinor: bigint;
};

export type FeeConfig = {
  /** Basis points of payment amount (30 = 0.30%). */
  platformFeeBps: number;
  /** Flat USDC minor added on every settle. */
  platformFeeFlatMinor: bigint;
  /** Flat USDC minor to recover relayer OKB gas (estimate + buffer). */
  gasRecoveryMinor: bigint;
};

export function loadFeeConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): FeeConfig {
  const bps = Number(env.PLATFORM_FEE_BPS || 0);
  const flat = BigInt(env.PLATFORM_FEE_FLAT_MINOR || "0");
  const gas = BigInt(env.GAS_RECOVERY_USDC_MINOR || "0");
  if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) {
    throw new Error("PLATFORM_FEE_BPS must be 0..10000");
  }
  if (flat < 0n || gas < 0n) {
    throw new Error("Fee flat amounts must be >= 0");
  }
  return {
    platformFeeBps: bps,
    platformFeeFlatMinor: flat,
    gasRecoveryMinor: gas,
  };
}

/** Compute USDC fees for a vendor payment amount (minor units). */
export function computeSettlementFees(
  paymentMinor: bigint,
  config: FeeConfig,
): FeeBreakdown {
  if (paymentMinor < 0n) throw new Error("paymentMinor must be >= 0");
  const bpsFee =
    config.platformFeeBps === 0
      ? 0n
      : (paymentMinor * BigInt(config.platformFeeBps)) / 10_000n;
  const platformFeeMinor = bpsFee + config.platformFeeFlatMinor;
  const gasRecoveryMinor = config.gasRecoveryMinor;
  const totalFeesMinor = platformFeeMinor + gasRecoveryMinor;
  return {
    paymentMinor,
    platformFeeMinor,
    gasRecoveryMinor,
    totalFeesMinor,
    totalDebitMinor: paymentMinor + totalFeesMinor,
    platformFeeBps: config.platformFeeBps,
    platformFeeFlatMinor: config.platformFeeFlatMinor,
    gasRecoveryFlatMinor: config.gasRecoveryMinor,
  };
}

export function feesEnabled(config: FeeConfig): boolean {
  return (
    config.platformFeeBps > 0 ||
    config.platformFeeFlatMinor > 0n ||
    config.gasRecoveryMinor > 0n
  );
}
