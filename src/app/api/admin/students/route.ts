import { NextResponse } from "next/server";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { createStudentAccount, findStudentConflict, validateNewStudent } from "@/lib/student-account";

const MAX_BODY_LENGTH = 16_384;

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const admin = await getCurrentUser();
    if (!admin || !isStaffRole(admin.role)) return NextResponse.json({ error: "Apenas administradores e operadores podem cadastrar alunos" }, { status: 403, headers: noStoreHeaders() });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return NextResponse.json({ error: "Formato inválido" }, { status: 415, headers: noStoreHeaders() });
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_LENGTH) return NextResponse.json({ error: "Requisição muito grande" }, { status: 413, headers: noStoreHeaders() });

    const body = await request.json() as Record<string, unknown>;
    const validation = validateNewStudent(body);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders() });
    const conflict = await findStudentConflict(validation.data);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409, headers: noStoreHeaders() });

    const created = await createStudentAccount(validation.data, admin.id);
    return NextResponse.json(created, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("student creation failed", error);
    return NextResponse.json({ error: "Não foi possível cadastrar o aluno" }, { status: 400, headers: noStoreHeaders() });
  }
}
