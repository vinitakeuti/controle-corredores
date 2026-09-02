import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem definir o acesso ao quadro" }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json() as { workAreaId?: unknown; memberIds?: unknown };
  const workAreaId = typeof body.workAreaId === "string" ? body.workAreaId : "";
  const memberIds = Array.isArray(body.memberIds) ? [...new Set(body.memberIds.filter((id): id is string => typeof id === "string"))] : [];
  if (!workAreaId || !memberIds.length) return NextResponse.json({ error: "Selecione ao menos uma pessoa para o quadro" }, { status: 400, headers: noStoreHeaders() });
  const people = await prisma.user.findMany({ where: { id: { in: memberIds }, active: true, role: { in: [UserRole.ADMIN, UserRole.OPERATOR] } }, select: { id: true } });
  if (people.length !== memberIds.length) return NextResponse.json({ error: "Colaborador inválido" }, { status: 400, headers: noStoreHeaders() });
  const area = await prisma.workArea.update({ where: { id: workAreaId }, data: { members: { deleteMany: {}, createMany: { data: memberIds.map((userId) => ({ userId })) } } }, include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } } }).catch(() => null);
  if (!area) return NextResponse.json({ error: "Quadro não encontrado" }, { status: 404, headers: noStoreHeaders() });
  return NextResponse.json({ members: area.members.map((member) => member.user) }, { headers: noStoreHeaders() });
}
