import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { StudentBillingControls } from "@/components/student-billing-controls";
import { requireRole } from "@/lib/auth";
import { calculateAge, formatCpf, formatCurrency, formatDate, formatPhone, paymentLabel, paymentMethodLabel, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(UserRole.ADMIN);
  const { id } = await params;
  const student = await prisma.user.findUnique({ where: { id }, include: { subscription: true, payments: { where: { status: PaymentStatus.PAID }, orderBy: { paidAt: "asc" } } } });
  if (!student || student.role !== UserRole.STUDENT) notFound();

  const firstPayment = student.payments[0];
  const lastPayment = student.payments.at(-1);
  const age = calculateAge(student.birthDate);
  const status = !student.active || student.leftAt ? "Desistente" : subscriptionLabel(student.subscription?.status ?? "");

  return <AppShell user={user} current="students"><div className="page-back"><Link href="/admin/alunos">← Alunos</Link></div><header className="page-heading"><div><p className="eyebrow">Perfil do aluno</p><h1>{student.name}.</h1><p>Dados cadastrais e histórico financeiro básico.</p></div></header><section className="profile-layout"><section className="panel profile-panel"><div className="profile-header"><div><p className="eyebrow">Cadastro</p><h2>Dados básicos</h2></div><span className={`pill ${status === "Em atraso" || status === "Desistente" ? "pill-coral" : ""}`}>{status || "Sem assinatura"}</span></div><dl className="profile-details"><div><dt>Nome</dt><dd>{student.name}</dd></div><div><dt>E-mail</dt><dd>{student.email}</dd></div><div><dt>CPF</dt><dd>{formatCpf(student.cpf)}</dd></div><div><dt>Idade</dt><dd>{age === null ? "—" : `${age} anos`}</dd></div><div><dt>Telefone</dt><dd>{formatPhone(student.phone)}</dd></div><div><dt>Data de ingresso</dt><dd>{formatDate(student.joinedAt)}</dd></div></dl></section><aside className="profile-side"><section className="panel"><div className="panel-heading"><div><h2>Pagamentos</h2><p>Resumo do histórico confirmado.</p></div></div><div className="summary-list"><div className="summary-item"><span>Data de pagamento</span><strong>{formatDate(firstPayment?.paidAt)}</strong></div><div className="summary-item"><span>Último pagamento</span><strong>{formatDate(lastPayment?.paidAt)}</strong></div><div className="summary-item"><span>Valor mais recente</span><strong>{lastPayment ? formatCurrency(lastPayment.amountCents) : "—"}</strong></div><div className="summary-item"><span>Próxima cobrança</span><strong>{formatDate(student.subscription?.nextBillingAt)}</strong></div></div></section></aside></section>{student.subscription ? <StudentBillingControls studentId={student.id} initialPriceCents={student.subscription.priceCents} initialAllowedMethods={student.subscription.allowedMethods} automaticPixActive={student.subscription.recurringEnabled && student.subscription.asaasPixAuthorizationStatus === "ACTIVE"} /> : null}<section className="panel profile-payments"><div className="panel-heading"><div><h2>Pagamentos confirmados</h2><p>{student.payments.length} lançamentos encontrados.</p></div></div>{student.payments.length ? <div className="table-scroll"><table className="payments-table"><thead><tr><th>Data</th><th>Método</th><th>Valor</th><th>Status</th></tr></thead><tbody>{student.payments.slice().reverse().map((payment) => <tr key={payment.id}><td>{formatDate(payment.paidAt)}</td><td>{paymentMethodLabel(payment.method)}</td><td>{formatCurrency(payment.amountCents)}</td><td><span className="pill">{paymentLabel(payment.status)}</span></td></tr>)}</tbody></table></div> : <div className="empty-state">Nenhum pagamento confirmado.</div>}</section></AppShell>;
}
