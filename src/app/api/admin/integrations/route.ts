import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clearAppmaxTokenCache } from "@/lib/appmax";
import { getIntegrationDirectory } from "@/lib/integration-directory";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders() });
}

async function requireAdmin(request: Request) {
  if (!isSameOrigin(request)) return { error: response({ error: "Origem inválida" }, 403) } as const;
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) return { error: response({ error: "Apenas administradores podem gerenciar integrações" }, 403) } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;
  return response(await getIntegrationDirectory());
}

export async function PATCH(request: Request) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return response({ error: "Formato inválido" }, 415);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: "JSON inválido" }, 400);
  }
  const provider = typeof body === "object" && body !== null && "provider" in body && typeof body.provider === "string" ? body.provider : "";
  if (!provider) return response({ error: "Informe o provedor que deve ficar ativo." }, 422);

  const target = await prisma.paymentIntegration.findUnique({ where: { provider }, select: { id: true } });
  if (!target) return response({ error: "Este provedor ainda não está configurado." }, 409);

  await prisma.$transaction(async (transaction) => {
    await transaction.paymentIntegration.updateMany({ data: { isActive: false } });
    await transaction.paymentIntegration.update({ where: { id: target.id }, data: { isActive: true } });
  });
  clearAppmaxTokenCache();
  return response(await getIntegrationDirectory());
}
