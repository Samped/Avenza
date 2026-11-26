import { type Hex } from "viem";
import { createXLayerPublicClient } from "./client";
import { tapeOutProcessorAbi } from "./abis";
import { TAPEOUT_FACTORY, XLAYER_MAINNET } from "./networks";

/** Cerebr processor on X Layer mainnet — public AND circuit (#1) used for PaymentLimit. */
export const AVENZA_TAPEOUT = {
  chainId: XLAYER_MAINNET.chainId,
  factory: TAPEOUT_FACTORY,
  /** Cerebr circuits contract (processor) */
  processor: "0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF" as const,
  /** AND(amountOk, budgetOk) — Cerebr neuron #1 */
  paymentLimitCircuitId: 1n,
  explorerProcessor:
    "https://www.oklink.com/xlayer/address/0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF",
  fabxStats: "https://fabx.tech/en/stats",
  tapeoutSite: "https://www.tapeout.net/",
} as const;

function toHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;
}

function fromHex(data: Hex): Uint8Array {
  const hex = data.replace(/^0x/, "");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Pack boolean inputs LSB-first into TapeOut eval bytes. */
export function packTapeOutInputs(bits: boolean[]): Hex {
  if (bits.length === 0) return "0x";
  const byteCount = Math.ceil(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  bits.forEach((b, i) => {
    if (b) bytes[Math.floor(i / 8)]! |= 1 << (i % 8);
  });
  return toHex(bytes);
}

/** Decode LSB-first output bits from TapeOut eval bytes. */
export function unpackTapeOutOutputs(data: Hex | Uint8Array, nOut: number): boolean[] {
  const bytes = typeof data === "string" ? fromHex(data) : data;
  const out: boolean[] = [];
  for (let i = 0; i < nOut; i++) {
    const byte = bytes[Math.floor(i / 8)] ?? 0;
    out.push(((byte >> (i % 8)) & 1) === 1);
  }
  return out;
}

export type TapeOutEvalResult = {
  processor: `0x${string}`;
  circuitId: string;
  inputs: Hex;
  rawOutput: Hex;
  pass: boolean;
  chainId: number;
  mode: "onchain" | "local-fallback";
};

/**
 * Evaluate PaymentLimit on TapeOut: AND(amountOk, budgetOk).
 * Uses configured processor/circuit or AVENZA defaults on X Layer mainnet.
 */
export async function evalPaymentLimitOnTapeOut(opts: {
  amountOk: boolean;
  budgetOk: boolean;
  processor?: `0x${string}`;
  circuitId?: bigint;
  chainId?: number;
  rpcUrl?: string;
  /** When false and RPC fails, throw instead of local fallback */
  allowLocalFallback?: boolean;
}): Promise<TapeOutEvalResult> {
  const processor = (opts.processor ||
    (process.env.TAPEOUT_PROCESSOR_ADDRESS as `0x${string}` | undefined) ||
    AVENZA_TAPEOUT.processor) as `0x${string}`;
  const circuitId = opts.circuitId ?? BigInt(process.env.TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID || "1");
  const chainId =
    opts.chainId ??
    Number(process.env.TAPEOUT_EVAL_CHAIN_ID || process.env.XLAYER_CHAIN_ID || AVENZA_TAPEOUT.chainId);
  const inputs = packTapeOutInputs([opts.amountOk, opts.budgetOk]);
  const localPass = opts.amountOk && opts.budgetOk;
  const rpcUrl =
    opts.rpcUrl ||
    process.env.TAPEOUT_RPC_URL ||
    (chainId === 196 ? "https://rpc.xlayer.tech" : process.env.XLAYER_RPC_URL);

  try {
    const client = createXLayerPublicClient(chainId, rpcUrl);
    const rawOutput = (await client.readContract({
      address: processor,
      abi: tapeOutProcessorAbi,
      functionName: "eval",
      args: [circuitId, inputs],
    })) as Hex;
    const bits = unpackTapeOutOutputs(rawOutput, 1);
    return {
      processor,
      circuitId: circuitId.toString(),
      inputs,
      rawOutput,
      pass: bits[0] === true,
      chainId,
      mode: "onchain",
    };
  } catch (err) {
    if (opts.allowLocalFallback === false) throw err;
    // Local NAND AND mirrors Cerebr #1 for offline/dev when RPC unavailable
    return {
      processor,
      circuitId: circuitId.toString(),
      inputs,
      rawOutput: packTapeOutInputs([localPass]),
      pass: localPass,
      chainId,
      mode: "local-fallback",
    };
  }
}

/** NAND netlist bytes for AND(in0, in1) — same encoding as Cerebr #1. */
export const AND_NETLIST_HEX =
  "0x0000000300000200000004000004" as const;
