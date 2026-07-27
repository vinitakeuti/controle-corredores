import { createHmac, randomBytes } from "node:crypto";

const DEV_TOKEN_SECRET = "local-development-only-session-secret-change-me";

function getTokenSecret() {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production");
  }
  return secret || DEV_TOKEN_SECRET;
}

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function hashOpaqueToken(token: string) {
  return createHmac("sha256", getTokenSecret()).update(token).digest("hex");
}

export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
