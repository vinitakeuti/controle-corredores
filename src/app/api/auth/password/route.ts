import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStoreHeaders() });
  try {
    const body = await request.json();
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < 8 || newPassword.length > 128) return NextResponse.json({ error: "A nova senha deve ter entre 8 e 128 caracteres" }, { status: 400, headers: noStoreHeaders() });
    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!record || !(await bcrypt.compare(currentPassword, record.passwordHash))) return NextResponse.json({ error: "Senha atual inválida" }, { status: 400, headers: noStoreHeaders() });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12), passwordIsTemporary: false } });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível alterar a senha" }, { status: 400, headers: noStoreHeaders() });
  }
}
