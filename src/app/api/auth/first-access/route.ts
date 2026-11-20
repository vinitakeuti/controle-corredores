import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, defaultPathForRole } from "@/lib/auth";
import { findFirstAccess } from "@/lib/first-access";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

// O aluno escaneou o QR Code do pré-cadastro: cria a própria senha e já entra.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json() as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8 || password.length > 128) return NextResponse.json({ error: "A senha deve ter entre 8 e 128 caracteres." }, { status: 400, headers: noStoreHeaders() });

    const access = await findFirstAccess(token);
    if (access.kind === "already-active") return NextResponse.json({ error: "Sua conta já tem senha. Entre com seu e-mail e senha." }, { status: 409, headers: noStoreHeaders() });
    if (access.kind !== "ready") return NextResponse.json({ error: "Este QR Code expirou ou já foi usado. Peça um novo à equipe da Pace Lab." }, { status: 400, headers: noStoreHeaders() });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (transaction) => {
      // Uso único mesmo com dois envios ao mesmo tempo.
      const claimed = await transaction.passwordResetToken.updateMany({ where: { id: access.tokenId, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new Error("first access token already used");
      await transaction.user.update({ where: { id: access.user.id }, data: { passwordHash, passwordIsTemporary: false } });
      await transaction.session.deleteMany({ where: { userId: access.user.id } });
    });
    await createSession(access.user.id, request);
    return NextResponse.json({ ok: true, redirectTo: defaultPathForRole(access.user.role) }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("first access failed", error);
    return NextResponse.json({ error: "Não foi possível criar sua senha. Peça um novo QR Code à equipe." }, { status: 400, headers: noStoreHeaders() });
  }
}
