import { SubscriptionStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildPersonalizedLiabilityTermPdf } from "@/lib/liability-term-pdf";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

function unavailableResponse(request: Request, status: number) {
  const returnUrl = new URL("/aluno", request.url);
  returnUrl.searchParams.set("termDownloadError", "1");
  return NextResponse.redirect(returnUrl, { status, headers: noStoreHeaders() });
}

export async function GET(request: Request) {
  try {
    if (!isSameOrigin(request)) return unavailableResponse(request, 303);
    const current = await getCurrentUser();
    if (!current || current.role !== UserRole.STUDENT) return NextResponse.redirect(new URL("/login", request.url), { status: 303, headers: noStoreHeaders() });
    const student = await prisma.user.findUnique({ where: { id: current.id }, include: { subscription: true } });
    if (!student?.liabilityTermRequiredAt || student.subscription?.status !== SubscriptionStatus.ACTIVE || student.liabilityTermStatus === "APPROVED") {
      return unavailableResponse(request, 303);
    }
    const pdf = await buildPersonalizedLiabilityTermPdf({ name: student.name, cpf: student.cpf, birthDate: student.birthDate, phone: student.phone, email: student.email, joinedAt: student.joinedAt, planName: student.subscription.planName });
    const name = student.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "aluno";
    const fileName = `termo-pace-lab-${name}.pdf`;
    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`, "Content-Length": String(pdf.byteLength), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("liability term download failed", error);
    return unavailableResponse(request, 303);
  }
}
