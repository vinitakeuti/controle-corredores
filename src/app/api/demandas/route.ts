import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { demandAssignmentMessage, sendMessage } from "@/lib/email";
import { managementAppUrl } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

async function staff() { const user = await getCurrentUser(); return user && (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR) ? user : null; }
function ids(value: unknown) { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, 30) : []; }
function scheduled(value: unknown) { if (typeof value !== "string" || !value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? undefined : date; }
const demandInclude = { assignees: { include: { user: { select: { id: true, name: true, email: true } } } } } as const;

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await staff(); if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as Record<string, unknown>;
    const workAreaId = typeof body.workAreaId === "string" ? body.workAreaId : "";
    const columnId = typeof body.columnId === "string" ? body.columnId : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 3000) : "";
    const scheduledAt = scheduled(body.scheduledAt); const assigneeIds = ids(body.assigneeIds);
    if (!workAreaId || !columnId || !title || scheduledAt === undefined) return NextResponse.json({ error: "Preencha título e uma data válida" }, { status: 400, headers: noStoreHeaders() });
    const [area, column, assignees, last] = await Promise.all([
      prisma.workArea.findUnique({ where: { id: workAreaId } }), prisma.workAreaColumn.findUnique({ where: { id: columnId } }),
      prisma.user.findMany({ where: { id: { in: assigneeIds }, active: true, role: { in: [UserRole.ADMIN, UserRole.OPERATOR] } }, select: { id: true, name: true, email: true } }),
      prisma.demand.aggregate({ where: { workAreaId, columnId }, _max: { position: true } }),
    ]);
    if (!area || !column || column.workAreaId !== workAreaId || assignees.length !== assigneeIds.length) return NextResponse.json({ error: "Área, coluna ou responsáveis inválidos" }, { status: 400, headers: noStoreHeaders() });
    const demand = await prisma.demand.create({ data: { workAreaId, columnId, createdById: user.id, title, description: description || null, position: (last._max.position ?? -1) + 1, scheduledAt: scheduledAt ?? null, assignees: { createMany: { data: assigneeIds.map((userId) => ({ userId })) } } }, include: demandInclude });
    await Promise.all(assignees.map((assignee) => sendMessage(assignee.email, demandAssignmentMessage({ recipientName: assignee.name, title, workAreaName: area.name, scheduledAt: demand.scheduledAt, demandUrl: `${managementAppUrl()}/admin/demandas/${area.id}` })).catch(() => undefined)));
    return NextResponse.json({ demand }, { headers: noStoreHeaders() });
  } catch (error) { console.error("demand creation failed", error); return NextResponse.json({ error: "Não foi possível criar a demanda" }, { status: 502, headers: noStoreHeaders() }); }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await staff(); if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const existing = await prisma.demand.findUnique({ where: { id }, include: { workArea: true, assignees: true } });
    if (!existing) return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404, headers: noStoreHeaders() });
    const columnId = typeof body.columnId === "string" ? body.columnId : undefined;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : undefined;
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 3000) : undefined;
    const scheduledAt = body.scheduledAt === undefined ? undefined : scheduled(body.scheduledAt);
    if (scheduledAt === undefined && body.scheduledAt !== undefined) return NextResponse.json({ error: "Data inválida" }, { status: 400, headers: noStoreHeaders() });
    const assigneeIds = body.assigneeIds === undefined ? null : ids(body.assigneeIds);
    const [column, assignees] = await Promise.all([
      columnId ? prisma.workAreaColumn.findUnique({ where: { id: columnId } }) : null,
      assigneeIds ? prisma.user.findMany({ where: { id: { in: assigneeIds }, active: true, role: { in: [UserRole.ADMIN, UserRole.OPERATOR] } }, select: { id: true, name: true, email: true } }) : [],
    ]);
    if (columnId && (!column || column.workAreaId !== existing.workAreaId)) return NextResponse.json({ error: "Coluna inválida" }, { status: 400, headers: noStoreHeaders() });
    if (assigneeIds && assignees.length !== assigneeIds.length) return NextResponse.json({ error: "Responsável inválido" }, { status: 400, headers: noStoreHeaders() });
    const position = columnId && columnId !== existing.columnId ? (await prisma.demand.aggregate({ where: { workAreaId: existing.workAreaId, columnId }, _max: { position: true } }))._max.position ?? -1 : undefined;
    const updated = await prisma.demand.update({ where: { id }, data: { ...(title ? { title } : {}), ...(description !== undefined ? { description: description || null } : {}), ...(columnId ? { columnId, position: position === undefined ? undefined : position + 1 } : {}), ...(scheduledAt !== undefined ? { scheduledAt } : {}), ...(assigneeIds !== null ? { assignees: { deleteMany: {}, createMany: { data: assigneeIds.map((userId) => ({ userId })) } } } : {}) }, include: demandInclude });
    const oldIds = new Set(existing.assignees.map((item) => item.userId));
    await Promise.all(assignees.filter((assignee) => !oldIds.has(assignee.id)).map((assignee) => sendMessage(assignee.email, demandAssignmentMessage({ recipientName: assignee.name, title: updated.title, workAreaName: existing.workArea.name, scheduledAt: updated.scheduledAt, demandUrl: `${managementAppUrl()}/admin/demandas/${existing.workAreaId}` })).catch(() => undefined)));
    return NextResponse.json({ demand: updated }, { headers: noStoreHeaders() });
  } catch (error) { console.error("demand update failed", error); return NextResponse.json({ error: "Não foi possível atualizar a demanda" }, { status: 502, headers: noStoreHeaders() }); }
}
