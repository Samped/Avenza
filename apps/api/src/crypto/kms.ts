import { createHash } from "node:crypto";

/**
 * Key-material provider for custody encryption.
 *
 * Default: ENCRYPTION_KEY from env (64 hex or any string → SHA-256).
 * Optional: KMS_PROVIDER=env|aws — AWS path loads ciphertext blob via
 * AWS_ENCRYPTION_KEY_CIPHERTEXT_B64 + AWS SDK when wired; until then falls back to env.
 *
 * Enterprise: set ENCRYPTION_KEY from your KMS/HSM unwrap step in the process supervisor
 * (Fly secret / Vault agent) so the app never persists the raw CMK.
 */
export function loadEncryptionKeyMaterial(): Buffer {
  const provider = (process.env.KMS_PROVIDER || "env").toLowerCase();
  if (provider === "aws") {
    // Placeholder for AWS KMS Decrypt — operators inject ENCRYPTION_KEY after unwrap.
    // Keeping a hard dependency on @aws-sdk out of the default build path.
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error(
        "KMS_PROVIDER=aws requires ENCRYPTION_KEY to be unwrapped into the process env (Vault/Fly secret sync).",
      );
    }
  }

  const raw = process.env.ENCRYPTION_KEY || "";
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY is required in production for custody secrets");
    }
    return createHash("sha256").update("avenza-dev-encryption-key").digest();
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return createHash("sha256").update(raw).digest();
}
