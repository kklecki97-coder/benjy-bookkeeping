import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for OAuth refresh tokens at rest.
 * ENCRYPTION_KEY must be 32 bytes hex (64 hex chars). Generate with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store as iv:tag:ciphertext, all hex
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = (payload ?? "").split(":");
  // Validate shape before handing to node:crypto, so a corrupt/empty stored
  // token surfaces as a clean domain error (callers map it to "reconnect
  // QuickBooks") instead of an opaque low-level crypto throw.
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Stored token is malformed (expected iv:tag:ciphertext).");
  }
  if (ivHex.length !== 24 || tagHex.length !== 32) {
    // 12-byte IV = 24 hex, 16-byte GCM tag = 32 hex
    throw new Error("Stored token has an invalid IV/tag length.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
