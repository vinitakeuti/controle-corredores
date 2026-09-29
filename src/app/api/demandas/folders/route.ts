import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

async function staff() {
  const user = await getCurrentUser();
  return user && canAccessFeature(user, "demands") ? user : null;
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await staff();
    if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ error: "Pasta inválida" }, { status: 400, headers: noStoreHeaders() });

    const folder = await prisma.demandFolder.findUnique({ where: { id }, select: { id: true, workAreaId: true } });
    if (!folder) return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404, headers: noStoreHeaders() });
    const membership = await prisma.workAreaMember.findUnique({ where: { workAreaId_userId: { workAreaId: folder.workAreaId, userId: user.id } }, select: { id: true } });
    if (!membership) return NextResponse.json({ error: "Você não faz parte deste quadro" }, { status: 403, headers: noStoreHeaders() });

    await prisma.demandFolder.delete({ where: { id } });
    return NextResponse.json({ deletedId: id }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("demand folder deletion failed", error);
    return NextResponse.json({ error: "Não foi possível excluir a pasta" }, { status: 502, headers: noStoreHeaders() });
  }
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
