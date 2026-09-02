import { NextResponse } from "next/server";
import { UserRole, WorkAreaType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

async function staff() {
  const user = await getCurrentUser();
  return user && (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR) ? user : null;
}

export async function GET() {
  const user = await staff();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const areas = await prisma.workArea.findMany({ where: { members: { some: { userId: user.id } } }, include: { _count: { select: { demands: true } } }, orderBy: [{ type: "asc" }, { name: "asc" }] });
  return NextResponse.json({ areas }, { headers: noStoreHeaders() });
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await staff();
    if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem criar áreas" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as { name?: unknown; type?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
    const type = body.type === "GENERAL" ? WorkAreaType.GENERAL : WorkAreaType.SECTOR;
    if (!name) return NextResponse.json({ error: "Informe o nome da área" }, { status: 400, headers: noStoreHeaders() });
    const area = await prisma.workArea.create({
      data: {
        name,
        type,
        columns: { create: ["Em aberto", "Segunda", "Terça", "Quarta", "Quinta", "Sexta"].map((columnName, position) => ({ name: columnName, position })) },
        members: { create: { userId: user.id } },
      },
    });
    return NextResponse.json({ area }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Unique constraint") ? "Já existe uma área com este nome" : "Não foi possível criar a área";
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
  }
}
