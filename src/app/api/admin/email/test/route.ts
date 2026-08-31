import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendEmailPreview } from "@/lib/email";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

const types = ["password-reset", "payment-failed", "payment-paid", "due-tomorrow"] as const;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem testar e-mails" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json();
    const recipient = typeof body.recipient === "string" ? body.recipient.trim().toLowerCase() : "";
    const type = typeof body.type === "string" && types.includes(body.type as typeof types[number]) ? body.type as typeof types[number] : null;
    if (!/^\S+@\S+\.\S+$/.test(recipient) || recipient.length > 254 || !type) return NextResponse.json({ error: "Informe um e-mail e um modelo válido." }, { status: 400, headers: noStoreHeaders() });
    await sendEmailPreview(type, recipient);
    return NextResponse.json({ ok: true, message: "E-mail de teste enviado." }, { headers: noStoreHeaders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível enviar o e-mail de teste." }, { status: 503, headers: noStoreHeaders() });
  }
}
