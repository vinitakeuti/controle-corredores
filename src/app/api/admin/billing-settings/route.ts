import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { cancelAsaasAutomaticPixAuthorization } from "@/lib/asaas";
import { getBillingSettings, parseAllowedMethods, parseAmountCents } from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const admin = await getCurrentUser();
    if (!admin || admin.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem alterar a cobrança" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as Record<string, unknown>;
    const current = await getBillingSettings();
    const basePriceCents = parseAmountCents(body.basePriceCents);
    const defaultAllowedMethods = parseAllowedMethods(body.defaultAllowedMethods);
    const applyToExisting = body.applyToExisting === true;
    const requestedExcludedIds = Array.isArray(body.excludedStudentIds) && body.excludedStudentIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 128)
      ? [...new Set(body.excludedStudentIds)]
      : [];
    if (!basePriceCents) return NextResponse.json({ error: "Informe um valor entre R$ 1,00 e R$ 100.000,00" }, { status: 400, headers: noStoreHeaders() });
    if (!defaultAllowedMethods) return NextResponse.json({ error: "Selecione ao menos um método de pagamento padrão" }, { status: 400, headers: noStoreHeaders() });

    const priceChanged = basePriceCents !== current.basePriceCents;
    const subscriptions = applyToExisting && priceChanged
      ? await prisma.subscription.findMany({
        where: { user: { active: true }, status: { not: "CANCELED" } },
        select: { id: true, userId: true, asaasPixAuthorizationId: true, recurringEnabled: true },
      })
      : [];
    const excludedIds = new Set(requestedExcludedIds);
    const adjustedSubscriptions = subscriptions.filter((subscription) => !excludedIds.has(subscription.userId));
    const authorizations = adjustedSubscriptions.flatMap((subscription) => subscription.asaasPixAuthorizationId && subscription.recurringEnabled
      ? [subscription.asaasPixAuthorizationId]
      : []);
    await Promise.all(authorizations.map((authorizationId) => cancelAsaasAutomaticPixAuthorization(authorizationId)));

    await prisma.$transaction(async (transaction) => {
      await transaction.billingSettings.upsert({
        where: { id: "platform" },
        update: { basePriceCents, defaultAllowedMethods },
        create: { id: "platform", basePriceCents, defaultAllowedMethods },
      });
      if (adjustedSubscriptions.length) {
        await transaction.subscription.updateMany({ where: { id: { in: adjustedSubscriptions.map((subscription) => subscription.id) } }, data: { priceCents: basePriceCents } });
        await transaction.paymentLink.updateMany({
          where: { userId: { in: adjustedSubscriptions.map((subscription) => subscription.userId) }, status: "OPEN" },
          data: { amountCents: basePriceCents },
        });
      }
      if (authorizations.length) {
        await transaction.subscription.updateMany({
          where: { asaasPixAuthorizationId: { in: authorizations } },
          data: { asaasPixAuthorizationStatus: "CANCELLED", recurringEnabled: false, recurringMethod: null },
        });
      }
    });
    return NextResponse.json({ updatedStudents: adjustedSubscriptions.length, excludedStudents: subscriptions.length - adjustedSubscriptions.length, reauthorizationRequired: authorizations.length }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("billing settings update failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a configuração de cobrança" }, { status: 502, headers: noStoreHeaders() });
  }
}
