import bcrypt from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { collaboratorWelcomeMessage, sendMessage } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { generateTemporaryPassword } from "@/lib/tokens";

const staffRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] as const;
const managerFeatures = ["overview", "demands", "sales", "students", "analysis", "finance", "plans", "integrations"] as const;

function managerPermissions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(managerFeatures.map((feature) => [feature, source[feature] === true]));
}

function commissionRateBps(value: unknown) {
  const rate = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 10000 || !Number.isInteger(rate)) return null;
  return rate;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem consultar colaboradores" }, { status: 403, headers: noStoreHeaders() });
  const collaborators = await prisma.user.findMany({ where: { role: { in: [...staffRoles] } }, select: { id: true, name: true, email: true, role: true, active: true, joinedAt: true, commissionRateBps: true, managerPermissions: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return NextResponse.json({ collaborators }, { headers: noStoreHeaders() });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem cadastrar colaboradores" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role === UserRole.ADMIN || body.role === UserRole.MANAGER || body.role === UserRole.OPERATOR ? body.role : null;
    const rateBps = commissionRateBps(body.commissionRateBps ?? 0);
    if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Informe um nome válido." }, { status: 400, headers: noStoreHeaders() });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400, headers: noStoreHeaders() });
    if (!role) return NextResponse.json({ error: "Escolha um papel para o colaborador." }, { status: 400, headers: noStoreHeaders() });
    if (rateBps === null) return NextResponse.json({ error: "Informe uma comissão entre 0% e 100%." }, { status: 400, headers: noStoreHeaders() });
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409, headers: noStoreHeaders() });
    const temporaryPassword = generateTemporaryPassword();
    const collaborator = await prisma.user.create({ data: { name, email, role, managerPermissions: role === UserRole.MANAGER ? managerPermissions(body.managerPermissions) : undefined, commissionRateBps: rateBps, passwordHash: await bcrypt.hash(temporaryPassword, 12), passwordIsTemporary: true }, select: { id: true, name: true, email: true, role: true, active: true, joinedAt: true, commissionRateBps: true, managerPermissions: true } });
    let emailSent = false;
    try {
      await sendMessage(collaborator.email, collaboratorWelcomeMessage({ name: collaborator.name, email: collaborator.email, temporaryPassword, role }));
      emailSent = true;
    } catch (error) {
      console.error("Failed to send collaborator welcome email", { collaboratorId: collaborator.id, error });
    }
    return NextResponse.json({ collaborator, temporaryPassword, emailSent }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível cadastrar o colaborador." }, { status: 400, headers: noStoreHeaders() });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem atualizar colaboradores" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json() as { collaboratorId?: unknown; commissionRateBps?: unknown; role?: unknown; managerPermissions?: unknown };
    const collaboratorId = typeof body.collaboratorId === "string" ? body.collaboratorId : "";
    const rateBps = commissionRateBps(body.commissionRateBps);
    const role = body.role === UserRole.ADMIN || body.role === UserRole.MANAGER || body.role === UserRole.OPERATOR ? body.role : null;
    if (!collaboratorId || rateBps === null) return NextResponse.json({ error: "Informe uma comissão entre 0% e 100%." }, { status: 400, headers: noStoreHeaders() });
    const existing = await prisma.user.findFirst({ where: { id: collaboratorId, role: { in: [...staffRoles] } }, select: { id: true, role: true } });
    if (!existing) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404, headers: noStoreHeaders() });
    if (role && collaboratorId === admin.id && role !== UserRole.ADMIN) return NextResponse.json({ error: "Seu próprio cargo não pode ser alterado aqui." }, { status: 400, headers: noStoreHeaders() });
    if (role && existing.role === UserRole.ADMIN && role !== UserRole.ADMIN && await prisma.user.count({ where: { role: UserRole.ADMIN } }) < 2) return NextResponse.json({ error: "Mantenha ao menos um administrador ativo." }, { status: 400, headers: noStoreHeaders() });
    const collaborator = await prisma.user.updateMany({ where: { id: collaboratorId }, data: { commissionRateBps: rateBps, ...(role ? { role, managerPermissions: role === UserRole.MANAGER ? managerPermissions(body.managerPermissions) : Prisma.JsonNull } : {}) } });
    if (!collaborator.count) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404, headers: noStoreHeaders() });
    return NextResponse.json({ commissionRateBps: rateBps, role, managerPermissions: role === UserRole.MANAGER ? managerPermissions(body.managerPermissions) : null }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar a comissão." }, { status: 400, headers: noStoreHeaders() });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem excluir colaboradores" }, { status: 403, headers: noStoreHeaders() });

  try {
    const body = await request.json() as { collaboratorId?: unknown };
    const collaboratorId = typeof body.collaboratorId === "string" ? body.collaboratorId : "";
    if (!collaboratorId) return NextResponse.json({ error: "Colaborador inválido." }, { status: 400, headers: noStoreHeaders() });
    if (collaboratorId === admin.id) return NextResponse.json({ error: "Sua própria conta não pode ser excluída aqui." }, { status: 400, headers: noStoreHeaders() });

    const collaborator = await prisma.user.findFirst({ where: { id: collaboratorId, role: { in: [...staffRoles] } }, select: { id: true, role: true } });
    if (!collaborator) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404, headers: noStoreHeaders() });
    if (collaborator.role === UserRole.ADMIN && await prisma.user.count({ where: { role: UserRole.ADMIN } }) < 2) return NextResponse.json({ error: "Mantenha ao menos um administrador ativo." }, { status: 400, headers: noStoreHeaders() });

    await prisma.$transaction([
      prisma.demand.updateMany({ where: { createdById: collaboratorId }, data: { createdById: admin.id } }),
      prisma.paymentLink.updateMany({ where: { createdById: collaboratorId }, data: { createdById: admin.id } }),
      prisma.financialEntry.updateMany({ where: { createdById: collaboratorId }, data: { createdById: admin.id } }),
      prisma.user.delete({ where: { id: collaboratorId } }),
    ]);
    return NextResponse.json({ deletedId: collaboratorId }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir o colaborador." }, { status: 400, headers: noStoreHeaders() });
  }
}
