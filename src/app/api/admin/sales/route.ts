import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json() as { studentId?: unknown; saleOwnerId?: unknown };
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const saleOwnerId = typeof body.saleOwnerId === "string" && body.saleOwnerId ? body.saleOwnerId : null;
  if (!studentId) return NextResponse.json({ error: "Aluno inválido" }, { status: 400, headers: noStoreHeaders() });
  if (saleOwnerId) {
    const owner = await prisma.user.findFirst({ where: { id: saleOwnerId, active: true, role: { in: [UserRole.ADMIN, UserRole.OPERATOR] } }, select: { id: true } });
    if (!owner) return NextResponse.json({ error: "Colaborador inválido" }, { status: 400, headers: noStoreHeaders() });
  }
  const student = await prisma.user.update({ where: { id: studentId }, data: { saleOwnerId }, select: { id: true, saleOwner: { select: { id: true, name: true } } } }).catch(() => null);
  if (!student) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404, headers: noStoreHeaders() });
  return NextResponse.json({ student }, { headers: noStoreHeaders() });
}
