import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/integration-crypto";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { isValidCpf } from "@/lib/student-input";

const types = ["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"] as const;
type PixType = (typeof types)[number];

function normalizePixKey(type: PixType, raw: string) {
  const value = raw.trim();
  if (type === "CPF") { const digits = value.replace(/\D/g, ""); return isValidCpf(digits) ? digits : null; }
  if (type === "CNPJ") { const digits = value.replace(/\D/g, ""); return digits.length === 14 ? digits : null; }
  if (type === "EMAIL") return /^\S+@\S+\.\S+$/.test(value) && value.length <= 120 ? value.toLowerCase() : null;
  if (type === "PHONE") { const digits = value.replace(/\D/g, ""); return digits.length >= 10 && digits.length <= 13 ? digits : null; }
  return /^[0-9a-fA-F-]{32,36}$/.test(value) ? value.toLowerCase() : null;
}

// O influenciador cadastra onde quer receber a comissão. A chave fica cifrada; o portal mostra só o final.
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user?.influencer) return NextResponse.json({ error: "Disponível só para Experts e Creators." }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const type = types.find((item) => item === body.type);
  const key = type && typeof body.key === "string" ? normalizePixKey(type, body.key) : null;
  if (!type || !key) return NextResponse.json({ error: "Confira o tipo e a chave Pix." }, { status: 400, headers: noStoreHeaders() });
  await prisma.influencer.update({ where: { id: user.influencer.id }, data: { pixKeyType: type, pixKeyEncrypted: encryptSecret(key), pixKeyHint: key.slice(-4), pixKeyUpdatedAt: new Date() } });
  return NextResponse.json({ type, hint: key.slice(-4) }, { headers: noStoreHeaders() });
}
