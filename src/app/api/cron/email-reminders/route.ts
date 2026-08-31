import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendDueTomorrowReminders } from "@/lib/email";
import { noStoreHeaders } from "@/lib/security";

function matches(left: string, right: string) {
  const first = Buffer.from(left); const second = Buffer.from(right);
  return first.length === second.length && timingSafeEqual(first, second);
}

export async function GET(request: Request) {
  const secret = process.env.EMAIL_CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied || !matches(secret, supplied)) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: noStoreHeaders() });
  try {
    return NextResponse.json({ ok: true, ...(await sendDueTomorrowReminders()) }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("email reminders cron failed", error);
    return NextResponse.json({ error: "Falha ao processar lembretes" }, { status: 503, headers: noStoreHeaders() });
  }
}
