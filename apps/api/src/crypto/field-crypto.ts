import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Field-level AES-256-GCM for sensitive business data at rest
 * (memos, invoice extraction, registration/email, payee contacts).
 *
 * Key: AVENZA_FIELD_ENCRYPTION_KEY (preferred). Falls back to JWT_SECRET in
 * non-production only. Custody secrets (wallet keys, ERP creds) use
 * ENCRYPTION_KEY via secrets.ts — keep those separate.
 */
function keyMaterial(): Buffer {
  const secret = process.env.AVENZA_FIELD_ENCRYPTION_KEY || "";
  if (secret) return createHash("sha256").update(secret).digest();

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AVENZA_FIELD_ENCRYPTION_KEY is required in production for field encryption",
    );
  }
  const fallback = process.env.JWT_SECRET || "avenza-dev-only";
  return createHash("sha256").update(fallback).digest();
}

/** AES-256-GCM encrypt → `iv:tag:ciphertext` hex. */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptField(payload: string): string {
  if (!looksEncrypted(payload)) {
    // Legacy plaintext fallback
    return payload;
  }
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivHex!, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex!, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex!, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function looksEncrypted(payload: string | null | undefined): boolean {
  if (!payload) return false;
  const parts = payload.split(":");
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

/** Encrypt if non-empty; leave null/undefined alone. Skips already-encrypted values. */
export function encryptFieldOptional(
  value: string | null | undefined,
): string | null | undefined {
  if (value == null) return value;
  if (value === "") return value;
  if (looksEncrypted(value)) return value;
  return encryptField(value);
}

/** Decrypt for API responses; plaintext legacy passes through. */
export function decryptFieldOptional(
  value: string | null | undefined,
): string | null | undefined {
  if (value == null) return value;
  if (value === "") return value;
  try {
    return decryptField(value);
  } catch {
    return value;
  }
}
