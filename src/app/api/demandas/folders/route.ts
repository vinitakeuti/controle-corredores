import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

async function staff() {
  const user = await getCurrentUser();
  return user && (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR) ? user : null;
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await staff(); if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as Record<string, unknown>;
    const workAreaId = typeof body.workAreaId === "string" ? body.workAreaId : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (!workAreaId || !name) return NextResponse.json({ error: "Informe o nome da pasta" }, { status: 400, headers: noStoreHeaders() });
    const membership = await prisma.workAreaMember.findUnique({ where: { workAreaId_userId: { workAreaId, userId: user.id } }, select: { id: true } });
    if (!membership) return NextResponse.json({ error: "Você não faz parte deste quadro" }, { status: 403, headers: noStoreHeaders() });
    const folder = await prisma.demandFolder.create({ data: { workAreaId, name }, select: { id: true, name: true } });
    return NextResponse.json({ folder }, { headers: noStoreHeaders() });
  } catch (error) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
    return NextResponse.json({ error: duplicate ? "Já existe uma pasta com esse nome" : "Não foi possível criar a pasta" }, { status: duplicate ? 409 : 502, headers: noStoreHeaders() });
  }
}
