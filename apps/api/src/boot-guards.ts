import { XLAYER_MAINNET, assertNativeUsdc } from "@avenza/chain";

const MAINNET_USDC = XLAYER_MAINNET.nativeUsdc.toLowerCase();
const CEREBR = "0xb04eb79d1a5eecaabaaff7b77d7c27578ee693ff";

function must(name: string): string {
  const v = process.env[name];
  if (!v || v === "dev") throw new Error(`Missing required env: ${name}`);
  return v;
}

function isMainnet(): boolean {
  return Number(process.env.XLAYER_CHAIN_ID || 0) === 196;
}

/** Fail closed before accepting traffic in production / mainnet. */
export function assertProductionAndMainnetGates(): void {
  const prod = process.env.NODE_ENV === "production";
  const mainnet = isMainnet();

  if (!prod && !mainnet) return;

  for (const k of [
    "JWT_SECRET",
    "ENCRYPTION_KEY",
    "AVENZA_FIELD_ENCRYPTION_KEY",
    "INTERNAL_WEBHOOK_TOKEN",
  ] as const) {
    must(k);
  }

  if (process.env.JWT_SECRET === "dev-insecure-jwt-secret-change-me-32") {
    throw new Error("JWT_SECRET must not use the insecure default");
  }
  if ((process.env.ENCRYPTION_KEY || "").replace(/^0x/, "").length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  if (process.env.ALLOW_TAPEOUT_LOCAL_FALLBACK === "true") {
    throw new Error("ALLOW_TAPEOUT_LOCAL_FALLBACK must be false in production/mainnet");
  }
  if (process.env.ALLOW_SIMULATED_SETTLEMENT === "true") {
    throw new Error("ALLOW_SIMULATED_SETTLEMENT is not allowed (simulated settle removed)");
  }

  if (!mainnet) return;

  // ——— X Layer mainnet 196 enterprise rails ———
  const usdc = must("USDC_TOKEN_ADDRESS");
  assertNativeUsdc(196, usdc);
  if (usdc.toLowerCase() !== MAINNET_USDC) {
    throw new Error(`Mainnet USDC must be ${XLAYER_MAINNET.nativeUsdc}`);
  }

  const rpc = must("XLAYER_RPC_URL");
  if (rpc.includes("test") || rpc.includes("1952")) {
    throw new Error("XLAYER_RPC_URL must be a mainnet RPC (not testnet)");
  }

  must("RELAYER_PRIVATE_KEY");
  must("PAYMENT_AUTHORIZATION_ADDRESS");
  must("TREASURY_ADDRESS");
  must("PAYMENT_POLICY_REGISTRY_ADDRESS");
  must("ORGANIZATION_REGISTRY_ADDRESS");
  must("VENDOR_REGISTRY_ADDRESS");
  must("EMERGENCY_CONTROL_ADDRESS");

  const processor = (
    process.env.SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS ||
    process.env.TAPEOUT_PROCESSOR_ADDRESS ||
    ""
  ).toLowerCase();
  if (!processor || processor === "0x0000000000000000000000000000000000000000") {
    throw new Error("TapeOut processor must be set (Cerebr) for mainnet settlement re-eval");
  }
  if (processor !== CEREBR && process.env.ALLOW_NON_CEREBR_PROCESSOR !== "true") {
    throw new Error(
      `Unexpected TapeOut processor ${processor}. Expected Cerebr 0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF (or set ALLOW_NON_CEREBR_PROCESSOR=true)`,
    );
  }

  const confs = Number(process.env.REQUIRED_CONFIRMATIONS || 0);
  if (confs < 3) {
    throw new Error("REQUIRED_CONFIRMATIONS must be >= 3 on mainnet");
  }

  const appUrl = process.env.APP_URL || "";
  if (prod && appUrl && !appUrl.startsWith("https://") && !appUrl.includes("localhost")) {
    throw new Error("APP_URL must be https in production mainnet");
  }

  const evalChain = Number(process.env.TAPEOUT_EVAL_CHAIN_ID || 196);
  if (evalChain !== 196) {
    throw new Error("TAPEOUT_EVAL_CHAIN_ID must be 196 for mainnet TapeOut eval");
  }

  const bps = Number(process.env.PLATFORM_FEE_BPS || 0);
  const flat = BigInt(process.env.PLATFORM_FEE_FLAT_MINOR || "0");
  const gas = BigInt(process.env.GAS_RECOVERY_USDC_MINOR || "0");
  if (bps > 0 || flat > 0n || gas > 0n) {
    const recip = process.env.PLATFORM_FEE_RECIPIENT || "";
    if (!/^0x[a-fA-F0-9]{40}$/.test(recip)) {
      throw new Error(
        "PLATFORM_FEE_RECIPIENT must be a valid address when platform/gas fees are enabled",
      );
    }
  }
}

export function requiredConfirmations(): number {
  const chainId = Number(process.env.XLAYER_CHAIN_ID || 1952);
  const fallback = chainId === 196 ? 3 : 1;
  return Number(process.env.REQUIRED_CONFIRMATIONS || fallback);
}

export function corsOrigins(): boolean | string | RegExp | (string | RegExp)[] {
  const multi = process.env.CORS_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (multi?.length) return multi;
  return process.env.APP_URL || "http://localhost:3000";
}
