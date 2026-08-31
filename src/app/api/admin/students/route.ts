import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import { getBillingSettings, parseAllowedMethods, parseAmountCents } from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidCpf, isValidPhone, normalizeCpf, normalizePhone, parseBirthDate } from "@/lib/student-input";
import { createOpaqueToken, generateTemporaryPassword, hashOpaqueToken } from "@/lib/tokens";
import { isSameOrigin, noStoreHeaders, publicUrl } from "@/lib/security";
import { planDisplayName } from "@/lib/plans";

const MAX_BODY_LENGTH = 16_384;

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const admin = await getCurrentUser();
    if (!admin || admin.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem cadastrar alunos" }, { status: 403, headers: noStoreHeaders() });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return NextResponse.json({ error: "Formato inválido" }, { status: 415, headers: noStoreHeaders() });
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_LENGTH) return NextResponse.json({ error: "Requisição muito grande" }, { status: 413, headers: noStoreHeaders() });

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
    const cpf = typeof body.cpf === "string" ? normalizeCpf(body.cpf) : null;
    const birthDate = typeof body.birthDate === "string" ? parseBirthDate(body.birthDate) : null;
    const billing = await getBillingSettings();
    const amountCents = body.amountCents === undefined ? billing.basePriceCents : parseAmountCents(body.amountCents);
    const allowedMethods = body.allowedMethods === undefined ? billing.defaultAllowedMethods : parseAllowedMethods(body.allowedMethods);
    const requestedPlanId = typeof body.planId === "string" ? body.planId : "";
    const plan = requestedPlanId ? await prisma.plan.findFirst({ where: { id: requestedPlanId, active: true, service: { active: true } }, include: { service: true } }) : null;

    if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Informe um nome válido" }, { status: 400, headers: noStoreHeaders() });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400, headers: noStoreHeaders() });
    if (!phone || !isValidPhone(phone)) return NextResponse.json({ error: "Informe um telefone válido" }, { status: 400, headers: noStoreHeaders() });
    if (!cpf || !isValidCpf(cpf)) return NextResponse.json({ error: "Informe um CPF válido" }, { status: 400, headers: noStoreHeaders() });
    if (body.birthDate && !birthDate) return NextResponse.json({ error: "Informe uma data de nascimento válida" }, { status: 400, headers: noStoreHeaders() });
    if (requestedPlanId && !plan) return NextResponse.json({ error: "O plano escolhido não está disponível" }, { status: 400, headers: noStoreHeaders() });
    if (!amountCents) return NextResponse.json({ error: "Informe um valor entre R$ 1,00 e R$ 100.000,00" }, { status: 400, headers: noStoreHeaders() });
    if (!allowedMethods) return NextResponse.json({ error: "Selecione ao menos um método de pagamento" }, { status: 400, headers: noStoreHeaders() });

    const [existingEmail, existingCpf] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      cpf ? prisma.user.findUnique({ where: { cpf }, select: { id: true } }) : null,
    ]);
    if (existingEmail) return NextResponse.json({ error: "Já existe um usuário com este e-mail" }, { status: 409, headers: noStoreHeaders() });
    if (existingCpf) return NextResponse.json({ error: "Já existe um usuário com este CPF" }, { status: 409, headers: noStoreHeaders() });

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const rawToken = createOpaqueToken();
    const student = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: { name, email, phone, cpf, birthDate, passwordHash, passwordIsTemporary: true, role: UserRole.STUDENT },
      });
      const subscription = await transaction.subscription.create({ data: { userId: created.id, status: SubscriptionStatus.INCOMPLETE, planId: plan?.id, planName: plan ? planDisplayName(plan) : undefined, priceCents: plan?.priceCents ?? amountCents, allowedMethods } });
      const paymentLink = await transaction.paymentLink.create({
        data: { tokenHash: hashOpaqueToken(rawToken), userId: created.id, createdById: admin.id, planId: subscription.planId, planName: subscription.planName, amountCents: subscription.priceCents, allowedMethods },
      });
      return { id: created.id, name: created.name, email: created.email, subscription, paymentLink };
    });

    const paymentUrl = publicUrl(request, `/pagamento/${rawToken}`);
    return NextResponse.json({ studentId: student.id, name: student.name, email: student.email, temporaryPassword, paymentUrl }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("student creation failed", error);
    return NextResponse.json({ error: "Não foi possível cadastrar o aluno" }, { status: 400, headers: noStoreHeaders() });
  }
}
