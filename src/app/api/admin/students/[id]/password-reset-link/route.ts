import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { canGeneratePasswordResetLink } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { passwordResetMessage, sendMessage } from "@/lib/email";
import { describeEmailFailure } from "@/lib/email-log";
import { portalUrlForRole } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/tokens";

// Links gerados pela equipe são repassados manualmente ao aluno, então ficam
// válidos por mais tempo que o link de autoatendimento (uma hora).
const LINK_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || !canGeneratePasswordResetLink(user)) return NextResponse.json({ error: "Você não tem permissão para gerar links de redefinição de senha." }, { status: 403, headers: noStoreHeaders() });

  try {
    const { id } = await context.params;
    const body: unknown = await request.json().catch(() => ({}));
    const sendEmail = Boolean(body && typeof body === "object" && (body as Record<string, unknown>).sendEmail === true);
    const student = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, active: true } });
    if (!student || student.role !== UserRole.STUDENT) return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404, headers: noStoreHeaders() });
    if (!student.active) return NextResponse.json({ error: "Reative o aluno antes de gerar um link de redefinição de senha." }, { status: 409, headers: noStoreHeaders() });

    const rawToken = createOpaqueToken();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    await prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.deleteMany({ where: { userId: student.id, usedAt: null } });
      await transaction.passwordResetToken.create({ data: { tokenHash: hashOpaqueToken(rawToken), userId: student.id, expiresAt } });
    });
    const resetUrl = portalUrlForRole(UserRole.STUDENT, `/redefinir-senha/${rawToken}`);
    console.info("password reset link generated", { studentId: student.id, generatedById: user.id, sendEmail });

    let emailSent = false;
    let emailError: string | null = null;
    if (sendEmail) {
      try {
        await sendMessage(student.email, passwordResetMessage(student.name, resetUrl, "24 horas"), { type: "PASSWORD_RESET" });
        emailSent = true;
      } catch (error) {
        emailError = describeEmailFailure(error).reason;
      }
    }

    return NextResponse.json({ resetUrl, expiresAt: expiresAt.toISOString(), emailSent, emailError }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("password reset link generation failed", error);
    return NextResponse.json({ error: "Não foi possível gerar o link de redefinição." }, { status: 500, headers: noStoreHeaders() });
  }
}
