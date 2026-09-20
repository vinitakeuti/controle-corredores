import { FinancialEntryType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

function amountCents(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents > 0 && cents <= 100_000_000 ? cents : null;
}

function occurredAt(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function admin() {
  const user = await getCurrentUser();
  return user?.role === UserRole.ADMIN ? user : null;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json() as Record<string, unknown>;
    const type = body.type === "EXPENSE" ? FinancialEntryType.EXPENSE : body.type === "REVENUE" ? FinancialEntryType.REVENUE : null;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const category = typeof body.category === "string" ? body.category.trim().slice(0, 60) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";
    const cents = amountCents(body.amount);
    const date = occurredAt(body.occurredAt);
    if (!type || !title || !cents || !date) return NextResponse.json({ error: "Preencha tipo, título, valor e data válidos." }, { status: 400, headers: noStoreHeaders() });
    const entry = await prisma.financialEntry.create({ data: { type, title, category: category || null, description: description || null, isFixed: body.isFixed === true, amountCents: cents, occurredAt: date, createdById: user.id }, include: { createdBy: { select: { name: true } } } });
    return NextResponse.json({ entry }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar o lançamento." }, { status: 400, headers: noStoreHeaders() });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  if (!await admin()) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await prisma.financialEntry.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
