import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

async function staff() {
  const user = await getCurrentUser();
  return user && (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR) ? user : null;
}
function nameOf(value: unknown) { return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 48) : ""; }

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  if (!await staff()) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json() as Record<string, unknown>;
  const workAreaId = typeof body.workAreaId === "string" ? body.workAreaId : "";
  const name = nameOf(body.name);
  if (!workAreaId || !name) return NextResponse.json({ error: "Informe o nome da coluna" }, { status: 400, headers: noStoreHeaders() });
  const [area, last] = await Promise.all([prisma.workArea.findUnique({ where: { id: workAreaId }, select: { id: true } }), prisma.workAreaColumn.aggregate({ where: { workAreaId }, _max: { position: true } })]);
  if (!area) return NextResponse.json({ error: "Área não encontrada" }, { status: 404, headers: noStoreHeaders() });
  try {
    const column = await prisma.workAreaColumn.create({ data: { workAreaId, name, position: (last._max.position ?? -1) + 1 } });
    return NextResponse.json({ column }, { headers: noStoreHeaders() });
  } catch { return NextResponse.json({ error: "Já existe uma coluna com este nome" }, { status: 409, headers: noStoreHeaders() }); }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  if (!await staff()) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json() as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const name = nameOf(body.name);
  if (!id || !name) return NextResponse.json({ error: "Informe o nome da coluna" }, { status: 400, headers: noStoreHeaders() });
  try {
    const column = await prisma.workAreaColumn.update({ where: { id }, data: { name } });
    return NextResponse.json({ column }, { headers: noStoreHeaders() });
  } catch { return NextResponse.json({ error: "Não foi possível atualizar a coluna" }, { status: 400, headers: noStoreHeaders() }); }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  if (!await staff()) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const column = await prisma.workAreaColumn.findUnique({ where: { id }, include: { _count: { select: { demands: true } }, workArea: { select: { id: true } } } });
  if (!column) return NextResponse.json({ error: "Coluna não encontrada" }, { status: 404, headers: noStoreHeaders() });
  if (column._count.demands) return NextResponse.json({ error: "Mova as demandas desta coluna antes de excluí-la" }, { status: 409, headers: noStoreHeaders() });
  const total = await prisma.workAreaColumn.count({ where: { workAreaId: column.workAreaId } });
  if (total <= 1) return NextResponse.json({ error: "A área precisa ter ao menos uma coluna" }, { status: 409, headers: noStoreHeaders() });
  await prisma.workAreaColumn.delete({ where: { id } });
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
