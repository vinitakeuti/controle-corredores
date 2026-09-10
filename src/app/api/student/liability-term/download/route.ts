import { SubscriptionStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildPersonalizedLiabilityTermPdf } from "@/lib/liability-term-pdf";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function GET(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const current = await getCurrentUser();
    if (!current || current.role !== UserRole.STUDENT) return NextResponse.json({ error: "Faça login como aluno para baixar o termo." }, { status: 403, headers: noStoreHeaders() });
    const student = await prisma.user.findUnique({ where: { id: current.id }, include: { subscription: true } });
    if (!student?.liabilityTermRequiredAt || student.subscription?.status !== SubscriptionStatus.ACTIVE || student.liabilityTermStatus === "APPROVED") {
      return NextResponse.json({ error: "O termo não está disponível para download." }, { status: 409, headers: noStoreHeaders() });
    }
    const pdf = await buildPersonalizedLiabilityTermPdf({ name: student.name, cpf: student.cpf, birthDate: student.birthDate, phone: student.phone, email: student.email, joinedAt: student.joinedAt, planName: student.subscription.planName });
    const name = student.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "aluno";
    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="termo-pace-lab-${name}.pdf"`, "Content-Length": String(pdf.byteLength), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("liability term download failed", error);
    return NextResponse.json({ error: "Não foi possível preparar o termo agora." }, { status: 502, headers: noStoreHeaders() });
  }
}
