import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { hashOpaqueToken } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!token || token.length > 255) return NextResponse.json({ error: "O link de redefinição é inválido." }, { status: 400, headers: noStoreHeaders() });
    if (password.length < 8 || password.length > 128) return NextResponse.json({ error: "A senha deve ter entre 8 e 128 caracteres." }, { status: 400, headers: noStoreHeaders() });
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashOpaqueToken(token) } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return NextResponse.json({ error: "Este link expirou ou já foi utilizado. Solicite outro." }, { status: 400, headers: noStoreHeaders() });
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await bcrypt.hash(password, 12), passwordIsTemporary: false } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: reset.userId } }),
    ]);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível redefinir a senha." }, { status: 400, headers: noStoreHeaders() });
  }
}
