/** Exact money helpers — never use floating point for settlement amounts. */

export type MoneyMinor = bigint;

export function parseDecimalToMinor(value: string | number, decimals = 6): MoneyMinor {
  const raw = typeof value === "number" ? value.toFixed(decimals) : String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid decimal amount: ${value}`);
  }
  const negative = raw.startsWith("-");
  const [wholePart = "0", fracPart = ""] = (negative ? raw.slice(1) : raw).split(".");
  const frac = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  const minor = BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(frac || "0");
  return negative ? -minor : minor;
}

export function minorToDecimalString(minor: MoneyMinor, decimals = 6): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0");
  const trimmed = frac.replace(/0+$/, "") || "0";
  const body = decimals === 0 ? whole.toString() : `${whole}.${trimmed}`;
  return negative ? `-${body}` : body;
}

export function assertPositiveMinor(amount: MoneyMinor): void {
  if (amount <= 0n) throw new Error("Amount must be positive");
}
