import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { PaymentLinkStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidCpf, isValidPhone, normalizeCpf, normalizePhone, parseBirthDate } from "@/lib/student-input";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { hashOpaqueToken } from "@/lib/tokens";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const { token } = await context.params;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
    const cpf = typeof body.cpf === "string" ? normalizeCpf(body.cpf) : null;
    const birthDate = typeof body.birthDate === "string" ? parseBirthDate(body.birthDate) : null;
    const password = typeof body.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Informe um nome válido" }, { status: 400, headers: noStoreHeaders() });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400, headers: noStoreHeaders() });
    if (!phone || !isValidPhone(phone)) return NextResponse.json({ error: "Informe um telefone válido" }, { status: 400, headers: noStoreHeaders() });
    if (!cpf || !isValidCpf(cpf)) return NextResponse.json({ error: "Informe um CPF válido" }, { status: 400, headers: noStoreHeaders() });
    if (body.birthDate && !birthDate) return NextResponse.json({ error: "Informe uma data de nascimento válida" }, { status: 400, headers: noStoreHeaders() });
    if (password.length < 8 || password.length > 128) return NextResponse.json({ error: "A senha deve ter pelo menos 8 caracteres" }, { status: 400, headers: noStoreHeaders() });

    const link = await prisma.paymentLink.findUnique({ where: { tokenHash: hashOpaqueToken(token) }, select: { id: true, status: true, userId: true, planName: true, amountCents: true } });
    if (!link || link.status !== PaymentLinkStatus.OPEN) return NextResponse.json({ error: "Link de pagamento inválido ou indisponível" }, { status: 404, headers: noStoreHeaders() });
    if (link.userId) return NextResponse.json({ error: "Este link já está vinculado a um aluno" }, { status: 409, headers: noStoreHeaders() });
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return NextResponse.json({ error: "Já existe uma conta com este e-mail" }, { status: 409, headers: noStoreHeaders() });
    if (cpf && await prisma.user.findUnique({ where: { cpf }, select: { id: true } })) return NextResponse.json({ error: "Já existe uma conta com este CPF" }, { status: 409, headers: noStoreHeaders() });

    const passwordHash = await bcrypt.hash(password, 12);
    const student = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({ data: { name, email, phone, cpf, birthDate, passwordHash, role: UserRole.STUDENT, passwordIsTemporary: false } });
      await transaction.subscription.create({ data: { userId: created.id, status: SubscriptionStatus.INCOMPLETE, planName: link.planName, priceCents: link.amountCents } });
      const attached = await transaction.paymentLink.updateMany({ where: { id: link.id, status: PaymentLinkStatus.OPEN, userId: null }, data: { userId: created.id } });
      if (attached.count !== 1) throw new Error("payment link already claimed");
      return created;
    });

    await createSession(student.id, request);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("checkout registration failed", error);
    return NextResponse.json({ error: "Não foi possível concluir o cadastro" }, { status: 400, headers: noStoreHeaders() });
  }
}
