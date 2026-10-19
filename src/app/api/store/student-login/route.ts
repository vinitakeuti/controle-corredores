import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { verifyCredentialsIncludingInactive } from "@/lib/auth";

const MAX_BODY_BYTES = 8_192;

function secretMatches(received: string | null, expected: string) {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const sharedSecret = process.env.STORE_AUTH_SHARED_SECRET;
  if (!sharedSecret) return NextResponse.json({ error: "Integração da loja indisponível." }, { status: 503 });
  if (!secretMatches(request.headers.get("x-store-auth-secret"), sharedSecret)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") return NextResponse.json({ error: "Formato inválido." }, { status: 415 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });

  const body = await request.json().catch(() => null);
  const email = body && typeof body === "object" && typeof (body as Record<string, unknown>).email === "string" ? (body as Record<string, string>).email : "";
  const password = body && typeof body === "object" && typeof (body as Record<string, unknown>).password === "string" ? (body as Record<string, string>).password : "";
  if (email.length > 254 || password.length > 128) return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });

  // A loja é um ambiente independente da assessoria: alunos inativos podem
  // continuar acessando e comprando normalmente, sem recuperar o acesso ao
  // portal de treinos ou às cobranças da assessoria.
  const user = await verifyCredentialsIncludingInactive(email, password);
  if (!user || user.role !== UserRole.STUDENT) return NextResponse.json({ error: "Use uma conta de aluno válida." }, { status: 401 });

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone ?? "", cpf: user.cpf ?? "" } }, { headers: { "Cache-Control": "no-store" } });
}
