import { NextResponse } from "next/server";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/tokens";
import { passwordResetMessage, sendMessage } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders, publicUrl } from "@/lib/security";

const responseMessage = "Se houver uma conta com este e-mail, enviaremos as instruções de redefinição.";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ ok: true, message: responseMessage }, { headers: noStoreHeaders() });
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, active: true } });
    if (!user?.active) return NextResponse.json({ ok: true, message: responseMessage }, { headers: noStoreHeaders() });

    const rawToken = createOpaqueToken();
    await prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.deleteMany({ where: { userId: user.id, OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }] } });
      await transaction.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await transaction.passwordResetToken.create({ data: { tokenHash: hashOpaqueToken(rawToken), userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    });
    await sendMessage(user.email, passwordResetMessage(user.name, publicUrl(request, `/redefinir-senha/${rawToken}`)));
    return NextResponse.json({ ok: true, message: responseMessage }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("password reset request failed", error);
    return NextResponse.json({ error: "Não foi possível enviar o e-mail agora. Tente novamente em instantes." }, { status: 503, headers: noStoreHeaders() });
  }
}
