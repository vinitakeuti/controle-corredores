import { NextResponse } from "next/server";
import { createSession, verifyCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = await verifyCredentials(email, password);

    if (!user) return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });

    await createSession(user.id);
    return NextResponse.json({ redirectTo: user.role === "ADMIN" ? "/admin" : "/aluno" });
  } catch {
    return NextResponse.json({ error: "Não foi possível entrar" }, { status: 400 });
  }
}
