import { NextResponse } from "next/server";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { findStaffPlan, paymentLinkTermsForPlan, planDisplayName } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { portalUrl } from "@/lib/portal";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/tokens";

// Link de uso único. Sem plano, o aluno escolhe entre os públicos; com plano
// (inclusive oculto ou cortesia), ele entra direto nessa condição.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const admin = await getCurrentUser();
  if (!admin || !isStaffRole(admin.role)) return NextResponse.json({ error: "Apenas administradores e operadores podem gerar links" }, { status: 403, headers: noStoreHeaders() });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const planId = typeof body.planId === "string" ? body.planId.slice(0, 100) : "";
  const plan = planId ? await findStaffPlan(planId) : null;
  if (planId && !plan) return NextResponse.json({ error: "Este plano não está mais disponível." }, { status: 404, headers: noStoreHeaders() });

  const rawToken = createOpaqueToken();
  await prisma.paymentLink.create({ data: { tokenHash: hashOpaqueToken(rawToken), createdById: admin.id, ...(plan ? paymentLinkTermsForPlan(plan) : {}) } });
  const paymentUrl = portalUrl("STUDENT", `/pagamento/${rawToken}`);
  return NextResponse.json({ paymentUrl, planName: plan ? planDisplayName(plan) : null, isCourtesy: Boolean(plan?.isCourtesy) }, { headers: noStoreHeaders() });
}
