import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const VERSION = "v1";

function encryptionKey() {
  const configuredKey = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!configuredKey && process.env.NODE_ENV === "production") {
    throw new Error("INTEGRATION_ENCRYPTION_KEY não configurada.");
  }

  const source = configuredKey || process.env.SESSION_SECRET?.trim();
  if (!source || source.length < 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY deve ter pelo menos 32 caracteres.");
  }
  return createHash("sha256").update(source, "utf8").digest();
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
  if (version !== VERSION || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("Segredo de integração inválido.");
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
