import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function keyBytes(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY is required in production for custody secrets");
    }
    // Dev-only fallback — never used when NODE_ENV=production
    return createHash("sha256").update("avenza-dev-encryption-key").digest();
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  // Derive a stable 32-byte key from whatever secret is configured.
  return createHash("sha256").update(raw).digest();
}

/** Encrypt UTF-8 plaintext → `iv:tag:ciphertext` hex package. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(packed: string): string {
  const [ivHex, tagHex, dataHex] = packed.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted secret format");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}
