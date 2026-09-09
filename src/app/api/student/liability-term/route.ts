import { SubscriptionStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

const maxPdfBytes = 10 * 1024 * 1024;

function safeFileName(value: string) {
  const base = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base.toLowerCase().endsWith(".pdf") ? base.slice(0, 150) : `${base.slice(0, 146) || "termo-assinado"}.pdf`;
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const current = await getCurrentUser();
    if (!current || current.role !== UserRole.STUDENT) return NextResponse.json({ error: "Faça login como aluno para enviar o termo." }, { status: 403, headers: noStoreHeaders() });
    if (!(request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) return NextResponse.json({ error: "Envie o documento em PDF." }, { status: 415, headers: noStoreHeaders() });

    const student = await prisma.user.findUnique({
      where: { id: current.id },
      include: { subscription: true },
    });
    if (!student?.liabilityTermRequiredAt || student.subscription?.status !== SubscriptionStatus.ACTIVE) return NextResponse.json({ error: "O termo estará disponível quando sua assinatura estiver ativa." }, { status: 409, headers: noStoreHeaders() });
    if (student.liabilityTermStatus === "APPROVED") return NextResponse.json({ error: "Seu termo já foi validado." }, { status: 409, headers: noStoreHeaders() });

    const formData = await request.formData();
    const file = formData.get("signedTerm");
    if (!(file instanceof File)) return NextResponse.json({ error: "Selecione o PDF assinado para enviar." }, { status: 400, headers: noStoreHeaders() });
    if (file.size < 5 || file.size > maxPdfBytes) return NextResponse.json({ error: "O PDF deve ter até 10 MB." }, { status: 400, headers: noStoreHeaders() });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "O arquivo enviado não é um PDF válido." }, { status: 400, headers: noStoreHeaders() });

    await prisma.user.update({
      where: { id: student.id },
      data: {
        liabilityTermStatus: "SUBMITTED",
        liabilityTermSignedPdf: Buffer.from(bytes),
        liabilityTermFileName: safeFileName(file.name),
        liabilityTermSubmittedAt: new Date(),
        liabilityTermReviewedAt: null,
        liabilityTermReviewedById: null,
        liabilityTermReviewNote: null,
        liabilityTermAcceptedAt: null,
        liabilityTermAcceptedName: null,
        liabilityTermAcceptedCpf: null,
        liabilityTermDocument: null,
      },
    });
    return NextResponse.json({ submitted: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("liability term upload failed", error);
    return NextResponse.json({ error: "Não foi possível enviar o termo agora." }, { status: 502, headers: noStoreHeaders() });
  }
}
