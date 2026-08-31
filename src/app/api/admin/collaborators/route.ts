import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { collaboratorWelcomeMessage, sendMessage } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { generateTemporaryPassword } from "@/lib/tokens";

const staffRoles = [UserRole.ADMIN, UserRole.OPERATOR] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem consultar colaboradores" }, { status: 403, headers: noStoreHeaders() });
  const collaborators = await prisma.user.findMany({ where: { role: { in: [...staffRoles] } }, select: { id: true, name: true, email: true, role: true, active: true, joinedAt: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
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
    const role = body.role === UserRole.ADMIN || body.role === UserRole.OPERATOR ? body.role : null;
    if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Informe um nome válido." }, { status: 400, headers: noStoreHeaders() });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400, headers: noStoreHeaders() });
    if (!role) return NextResponse.json({ error: "Escolha um papel para o colaborador." }, { status: 400, headers: noStoreHeaders() });
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409, headers: noStoreHeaders() });
    const temporaryPassword = generateTemporaryPassword();
    const collaborator = await prisma.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(temporaryPassword, 12), passwordIsTemporary: true }, select: { id: true, name: true, email: true, role: true, active: true, joinedAt: true } });
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
