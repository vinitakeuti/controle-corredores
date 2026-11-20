import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { canAccessFeature } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { parseInfluencerInput } from "@/lib/influencers";
import { portalUrl } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { FIRST_ACCESS_TTL_MS } from "@/lib/student-account";
import { isValidCpf, isValidPhone, normalizeCpf, normalizePhone } from "@/lib/student-input";
import { createOpaqueToken, generateTemporaryPassword, hashOpaqueToken } from "@/lib/tokens";

// Torna um aluno Expert/Creator ou cria um parceiro (influenciador que não é aluno).
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const staff = await getCurrentUser();
  if (!staff || !canAccessFeature(staff, "marketing")) return NextResponse.json({ error: "Sem permissão para o programa Experts & Creators." }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStoreHeaders() });
    const input = body as Record<string, unknown>;
    const parsed = parseInfluencerInput(input, false);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: noStoreHeaders() });
    const { type, couponCode, commissionBps, planCommission, storeCommission, discountPercent, discountUntil } = parsed.data;
    if (await prisma.influencer.findUnique({ where: { couponCode: couponCode! }, select: { id: true } })) return NextResponse.json({ error: "Este cupom já é de outro influenciador." }, { status: 409, headers: noStoreHeaders() });
    // Regras de comissão vazias seguem o padrão do programa.
    const profile = { type: type!, couponCode: couponCode!, commissionBps: commissionBps ?? null, planCommission: planCommission ?? null, storeCommission: storeCommission ?? null, discountPercent: discountPercent ?? 0, discountUntil: discountUntil ?? null, createdById: staff.id };

    // Aluno existente.
    if (typeof input.studentId === "string" && input.studentId) {
      const student = await prisma.user.findUnique({ where: { id: input.studentId }, select: { id: true, role: true, influencer: { select: { id: true } } } });
      if (!student || student.role !== UserRole.STUDENT) return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404, headers: noStoreHeaders() });
      if (student.influencer) return NextResponse.json({ error: "Este aluno já faz parte do programa." }, { status: 409, headers: noStoreHeaders() });
      const influencer = await prisma.influencer.create({ data: { ...profile, userId: student.id } });
      return NextResponse.json({ influencer: { id: influencer.id } }, { headers: noStoreHeaders() });
    }

    // Parceiro: cria o acesso com senha temporária e QR de primeiro acesso.
    const partner = input.partner && typeof input.partner === "object" ? input.partner as Record<string, unknown> : null;
    if (!partner) return NextResponse.json({ error: "Escolha um aluno ou informe os dados do parceiro." }, { status: 400, headers: noStoreHeaders() });
    const name = typeof partner.name === "string" ? partner.name.trim().replace(/\s+/g, " ") : "";
    const email = typeof partner.email === "string" ? partner.email.trim().toLowerCase() : "";
    const phone = typeof partner.phone === "string" ? normalizePhone(partner.phone) : null;
    const cpf = typeof partner.cpf === "string" && partner.cpf.trim() ? normalizeCpf(partner.cpf) : null;
    if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Informe o nome do parceiro." }, { status: 400, headers: noStoreHeaders() });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400, headers: noStoreHeaders() });
    if (!phone || !isValidPhone(phone)) return NextResponse.json({ error: "Informe um telefone válido." }, { status: 400, headers: noStoreHeaders() });
    if (typeof partner.cpf === "string" && partner.cpf.trim() && (!cpf || !isValidCpf(cpf))) return NextResponse.json({ error: "CPF inválido." }, { status: 400, headers: noStoreHeaders() });
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return NextResponse.json({ error: "Já existe uma conta com este e-mail. Se for um aluno, escolha-o na lista." }, { status: 409, headers: noStoreHeaders() });
    if (cpf && await prisma.user.findUnique({ where: { cpf }, select: { id: true } })) return NextResponse.json({ error: "Já existe uma conta com este CPF." }, { status: 409, headers: noStoreHeaders() });

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const firstAccessToken = createOpaqueToken();
    const influencer = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({ data: { name, email, phone, cpf, passwordHash, passwordIsTemporary: true, role: UserRole.PARTNER } });
      await transaction.passwordResetToken.create({ data: { tokenHash: hashOpaqueToken(firstAccessToken), userId: user.id, expiresAt: new Date(Date.now() + FIRST_ACCESS_TTL_MS) } });
      return transaction.influencer.create({ data: { ...profile, userId: user.id } });
    });
    return NextResponse.json({
      influencer: { id: influencer.id },
      access: { name, email, temporaryPassword, loginUrl: portalUrl("STUDENT", "/login"), firstAccessUrl: portalUrl("STUDENT", `/primeiro-acesso/${firstAccessToken}`) },
    }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Cupom, e-mail ou CPF já usados por outra conta." }, { status: 409, headers: noStoreHeaders() });
    console.error("influencer creation failed", error);
    return NextResponse.json({ error: "Não foi possível adicionar ao programa." }, { status: 500, headers: noStoreHeaders() });
  }
}
