import { PaymentStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildLiabilityTermDocument, LIABILITY_TERM_VERSION } from "@/lib/liability-term";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

function comparableName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return NextResponse.json({ error: "Formato inválido" }, { status: 415, headers: noStoreHeaders() });
    const current = await getCurrentUser();
    if (!current || current.role !== UserRole.STUDENT) return NextResponse.json({ error: "Faça login como aluno para assinar o termo." }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as Record<string, unknown>;
    const signature = typeof body.signature === "string" ? body.signature.trim().replace(/\s+/g, " ") : "";
    if (body.accepted !== true || !signature) return NextResponse.json({ error: "Confirme a leitura e informe seu nome completo para assinar." }, { status: 400, headers: noStoreHeaders() });

    const student = await prisma.user.findUnique({
      where: { id: current.id },
      include: {
        subscriptions: true,
        payments: { where: { status: PaymentStatus.PAID }, select: { id: true }, take: 1 },
      },
    });
    if (!student || !student.liabilityTermRequiredAt) return NextResponse.json({ error: "Este termo não está pendente para este acesso." }, { status: 409, headers: noStoreHeaders() });
    if (student.liabilityTermAcceptedAt) return NextResponse.json({ accepted: true, alreadyAccepted: true }, { headers: noStoreHeaders() });
    if (!student.subscriptions.some((subscription) => subscription.status === SubscriptionStatus.ACTIVE) || student.payments.length === 0) return NextResponse.json({ error: "O termo estará disponível após a confirmação do pagamento." }, { status: 409, headers: noStoreHeaders() });
    if (comparableName(signature) !== comparableName(student.name)) return NextResponse.json({ error: "A assinatura deve corresponder ao seu nome completo cadastrado." }, { status: 400, headers: noStoreHeaders() });

    const acceptedAt = new Date();
    const result = await prisma.user.updateMany({
      where: { id: student.id, liabilityTermAcceptedAt: null },
      data: {
        liabilityTermAcceptedAt: acceptedAt,
        liabilityTermAcceptedName: signature,
        liabilityTermAcceptedCpf: student.cpf,
        liabilityTermVersion: LIABILITY_TERM_VERSION,
        liabilityTermDocument: buildLiabilityTermDocument({
          name: student.name,
          cpf: student.cpf,
          birthDate: student.birthDate,
          phone: student.phone,
          email: student.email,
          joinedAt: student.joinedAt,
          planName: student.subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.ACTIVE).map((subscription) => subscription.planName).join(" + "),
        }),
      },
    });
    return NextResponse.json({ accepted: true, acceptedAt: acceptedAt.toISOString(), alreadyAccepted: result.count === 0 }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("liability term acceptance failed", error);
    return NextResponse.json({ error: "Não foi possível registrar sua assinatura agora." }, { status: 502, headers: noStoreHeaders() });
  }
}
