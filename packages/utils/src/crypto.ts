import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Authenticated symmetric encryption for secrets at rest (e.g. a seller's
 * Razorpay key secret, C6). AES-256-GCM: confidentiality + integrity (a tampered
 * ciphertext fails to decrypt rather than yielding garbage).
 *
 * SERVER ONLY. The key comes from GATEWAY_ENCRYPTION_KEY (base64 of 32 random
 * bytes). Generate one with: `openssl rand -base64 32`. Rotating it makes old
 * ciphertexts undecryptable, so rotation needs a re-encrypt migration.
 *
 * Wire format (single string, all base64, dot-separated): `v1.iv.tag.ciphertext`
 * — the version tag lets us change scheme later without ambiguity.
 */

const VERSION = "v1";

function getKey(): Buffer {
  const b64 = process.env.GATEWAY_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "GATEWAY_ENCRYPTION_KEY is not set — required to encrypt/decrypt gateway secrets.",
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error(
      `GATEWAY_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`,
    );
  }
  return key;
}

/** Encrypt UTF-8 plaintext → `v1.iv.tag.ciphertext` (all base64). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit nonce, standard for GCM
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/** Decrypt a `v1.iv.tag.ciphertext` bundle → UTF-8 plaintext. Throws if the key
 *  is wrong or the ciphertext was tampered with (GCM auth failure). */
export function decryptSecret(bundle: string): string {
  const parts = bundle.split(".");
  const [version, ivB64, tagB64, dataB64] = parts;
  if (
    parts.length !== 4 ||
    version !== VERSION ||
    !ivB64 ||
    !tagB64 ||
    !dataB64
  ) {
    throw new Error("Malformed or unsupported ciphertext bundle.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Mask a key id for display, e.g. `rzp_test_Suj6T0WBVFATre` → `rzp_test_…ATre`. */
export function maskKeyId(keyId: string): string {
  if (keyId.length <= 12) return keyId;
  const prefixEnd = keyId.indexOf("_", keyId.indexOf("_") + 1);
  const head = prefixEnd > 0 ? keyId.slice(0, prefixEnd + 1) : keyId.slice(0, 8);
  return `${head}…${keyId.slice(-4)}`;
}
