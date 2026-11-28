import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { loadEncryptionKeyMaterial } from "./kms";

function keyBytes(): Buffer {
  return loadEncryptionKeyMaterial();
}

const DOC_MAGIC = Buffer.from("AVZE");

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

/** True when value looks like AES-GCM packed secret (not raw whsec_/plaintext). */
export function looksEncryptedSecret(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => /^[0-9a-fA-F]+$/.test(p));
}

/** Decrypt webhook/custody secret; pass through legacy plaintext. */
export function revealMaybeEncryptedSecret(value: string): string {
  if (!value) return value;
  if (looksEncryptedSecret(value)) return decryptSecret(value);
  return value;
}

/** Encrypt document bytes → `AVZE || iv(12) || tag(16) || ciphertext`. */
export function encryptBytes(data: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([DOC_MAGIC, iv, tag, enc]);
}

export function decryptBytes(packed: Buffer): Buffer {
  if (packed.length >= 4 && packed.subarray(0, 4).equals(DOC_MAGIC)) {
    const iv = packed.subarray(4, 16);
    const tag = packed.subarray(16, 32);
    const data = packed.subarray(32);
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
  // Legacy plaintext files written before document encryption.
  return packed;
}
