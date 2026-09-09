import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { LIABILITY_TERM_PDF_SHA256, LIABILITY_TERM_VERSION } from "@/lib/liability-term";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

async function adminUser(request: Request) {
  if (!isSameOrigin(request)) return null;
  const user = await getCurrentUser();
  return user?.role === UserRole.ADMIN ? user : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await adminUser(request);
  if (!admin) return NextResponse.json({ error: "Apenas administradores podem consultar o termo." }, { status: 403, headers: noStoreHeaders() });
  const { id } = await context.params;
  const student = await prisma.user.findFirst({ where: { id, role: UserRole.STUDENT }, select: { name: true, liabilityTermSignedPdf: true, liabilityTermFileName: true } });
  if (!student?.liabilityTermSignedPdf) return NextResponse.json({ error: "Nenhum PDF assinado foi enviado." }, { status: 404, headers: noStoreHeaders() });
  const fallbackName = `termo-assinado-${student.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() || "aluno"}.pdf`;
  return new NextResponse(student.liabilityTermSignedPdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${student.liabilityTermFileName ?? fallbackName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await adminUser(request);
    if (!admin) return NextResponse.json({ error: "Apenas administradores podem validar o termo." }, { status: 403, headers: noStoreHeaders() });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return NextResponse.json({ error: "Formato inválido" }, { status: 415, headers: noStoreHeaders() });
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const action = body.action === "APPROVE" || body.action === "REJECT" ? body.action : null;
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
    if (!action) return NextResponse.json({ error: "Escolha aprovar ou solicitar novo envio." }, { status: 400, headers: noStoreHeaders() });
    if (action === "REJECT" && note.length < 3) return NextResponse.json({ error: "Explique ao aluno o motivo do novo envio." }, { status: 400, headers: noStoreHeaders() });

    const student = await prisma.user.findFirst({ where: { id, role: UserRole.STUDENT }, select: { id: true, name: true, cpf: true, liabilityTermStatus: true, liabilityTermSignedPdf: true, liabilityTermSubmittedAt: true } });
    if (!student?.liabilityTermSignedPdf || student.liabilityTermStatus !== "SUBMITTED") return NextResponse.json({ error: "Não há um termo pendente de validação." }, { status: 409, headers: noStoreHeaders() });

    const reviewedAt = new Date();
    await prisma.user.update({
      where: { id: student.id },
      data: action === "APPROVE" ? {
        liabilityTermStatus: "APPROVED",
        liabilityTermAcceptedAt: student.liabilityTermSubmittedAt ?? reviewedAt,
        liabilityTermAcceptedName: student.name,
        liabilityTermAcceptedCpf: student.cpf,
        liabilityTermVersion: LIABILITY_TERM_VERSION,
        liabilityTermDocument: `Documento-base ${LIABILITY_TERM_VERSION}; SHA-256 ${LIABILITY_TERM_PDF_SHA256}. PDF assinado eletronicamente via GOV.BR e validado pela administração da Pace Lab.`,
        liabilityTermReviewedAt: reviewedAt,
        liabilityTermReviewedById: admin.id,
        liabilityTermReviewNote: note || null,
      } : {
        liabilityTermStatus: "REJECTED",
        liabilityTermReviewedAt: reviewedAt,
        liabilityTermReviewedById: admin.id,
        liabilityTermReviewNote: note,
      },
    });
    return NextResponse.json({ ok: true, status: action === "APPROVE" ? "APPROVED" : "REJECTED" }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("liability term review failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a validação do termo." }, { status: 502, headers: noStoreHeaders() });
  }
}
