import { AiAudience, AiChannel, FinancialEntryType, Prisma, SubscriptionStatus, UserRole, WorkAreaType } from "@prisma/client";
import { canAccessFeature } from "@/lib/access-control";
import type { SessionUser } from "@/lib/auth";
import { financeMonthRange, loadFinanceMonth } from "@/lib/finance-month";
import { calculateAge, formatCpf, formatCurrency, formatPhone, maceioDateParts, maceioDayEnd, maceioDayStart, paymentLabel, paymentMethodLabel, subscriptionLabel } from "@/lib/format";
import { managementAppUrl, portalUrl } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { createStudentAccount, findStudentConflict, validateNewStudent } from "@/lib/student-account";
import type { ToolDefinition } from "@/lib/ai/openrouter";
import { notifyTeam } from "@/lib/whatsapp/notify";
import { formatWhatsapp } from "@/lib/whatsapp/phone";

// Quem está pedindo e por onde. Na gestão é sempre alguém da equipe com sessão válida.
// No WhatsApp a pessoa é identificada pelo número: equipe (número cadastrado no assistente),
// aluno (telefone do cadastro) ou lead (qualquer outro). Para lead, "actor" é só um marcador.
export type ToolContext = {
  audience: AiAudience;
  channel: AiChannel;
  isGroup: boolean;
  leadPrices: boolean;
  actor: Pick<SessionUser, "id" | "name" | "role" | "managerPermissions">;
  contact?: { phone: string | null; name: string | null };
  // Equipe num grupo que não foi marcado como interno: nenhuma ferramenta de dados internos.
  restricted?: boolean;
  conversationId: string;
};

type Args = Record<string, unknown>;
type Prepared = { ok: true; input: Prisma.InputJsonObject; summary: string } | { ok: false; error: string };
export type Executed = { result: Prisma.InputJsonObject; message: string; display?: Record<string, string> };

type BaseTool = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  audiences: AiAudience[];
  allowed: (context: ToolContext) => boolean;
};
type ReadTool = BaseTool & { mutating: false; run: (args: Args, context: ToolContext) => Promise<unknown> };
type WriteTool = BaseTool & { mutating: true; irreversible?: boolean; prepare: (args: Args, context: ToolContext) => Promise<Prepared>; execute: (input: Args, context: ToolContext) => Promise<Executed> };
export type AssistantTool = ReadTool | WriteTool;

const STAFF = [AiAudience.STAFF];
const PUBLIC = [AiAudience.LEAD, AiAudience.STUDENT];
const periodLabels: Record<string, string> = { MONTHLY: "mensal", QUARTERLY: "trimestral", SEMIANNUAL: "semestral", ANNUAL: "anual" };
const can = (feature: Parameters<typeof canAccessFeature>[1]) => (context: ToolContext) => context.audience === AiAudience.STAFF && canAccessFeature(context.actor, feature);
const isAdmin = (context: ToolContext) => context.audience === AiAudience.STAFF && context.actor.role === UserRole.ADMIN;

const text = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit", year: "numeric" });
const when = (date: Date | null | undefined) => (date ? dateTime.format(date) : null);
const day = (date: Date | null | undefined) => (date ? dateOnly.format(date) : null);
const profileUrl = (id: string) => `${managementAppUrl()}/admin/alunos/${id}`;
// A IA vê só o final do CPF; o documento completo fica no perfil do aluno.
// Situação de pagamento com a mesma regra das telas (Alunos, Analisar dados, Visão geral):
// assinatura ativa com vencimento já passado conta como atraso.
type SubscriptionLike = { status: SubscriptionStatus; nextBillingAt: Date | null; isCourtesy: boolean };
function paymentSituation(subscription: SubscriptionLike) {
  if (subscription.isCourtesy) return "Cortesia";
  if (subscription.status === SubscriptionStatus.INCOMPLETE || subscription.status === SubscriptionStatus.CANCELED) return subscriptionLabel(subscription.status);
  if (subscription.status === SubscriptionStatus.PAST_DUE || (subscription.nextBillingAt && subscription.nextBillingAt < new Date())) return subscriptionLabel(SubscriptionStatus.PAST_DUE);
  return subscriptionLabel(subscription.status);
}
const maskCpf = (cpf: string | null) => { const digits = (cpf ?? "").replace(/\D/g, ""); return digits.length === 11 ? `***.***.${digits.slice(6, 9)}-${digits.slice(9)}` : null; };

// "AAAA-MM-DD" no fuso de Maceió.
function parseDay(value: unknown) {
  const match = typeof value === "string" ? value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return null;
  const [year, month, dayOfMonth] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Recusa datas que não existem (31/02 viraria 03/03).
  const check = new Date(Date.UTC(year, month - 1, dayOfMonth));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== dayOfMonth) return null;
  return { year, month, day: dayOfMonth, start: maceioDayStart(year, month, dayOfMonth) };
}

// "AAAA-MM-DDTHH:mm" no fuso de Maceió (UTC−3, sem horário de verão).
function parseLocalDateTime(value: unknown) {
  const match = typeof value === "string" ? value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/) : null;
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function reais(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/\./g, "").replace(",", ".")) : NaN;
  if (!Number.isFinite(number)) return null;
  const cents = Math.round(number * 100);
  return cents > 0 && cents <= 100_000_000 ? cents : null;
}

async function memberDemand(id: string, userId: string) {
  const demand = await prisma.demand.findUnique({ where: { id }, include: { workArea: { select: { id: true, name: true } } } });
  if (!demand) return null;
  const membership = await prisma.workAreaMember.findUnique({ where: { workAreaId_userId: { workAreaId: demand.workAreaId, userId } }, select: { id: true } });
  return membership ? demand : null;
}

const studentSummarySelect = {
  id: true, name: true, email: true, phone: true, active: true,
  subscription: { select: { status: true, planName: true, priceCents: true, nextBillingAt: true, isCourtesy: true } },
} as const;

const tools: AssistantTool[] = [
  {
    name: "buscar_alunos",
    label: "Buscou alunos",
    description: "Procura alunos por nome, e-mail, CPF ou telefone. Retorna até 10 resultados com o id, a situação da conta e da assinatura. Use antes de ver_aluno quando não souber o id.",
    parameters: { type: "object", properties: { busca: { type: "string", description: "Nome, e-mail, CPF ou telefone (parte serve)." }, situacao: { type: "string", enum: ["ativos", "inativos", "todos"], description: "Filtra pela conta. Padrão: todos." } }, required: ["busca"], additionalProperties: false },
    audiences: STAFF,
    allowed: can("students"),
    mutating: false,
    async run(args) {
      const term = text(args.busca, 120);
      if (term.length < 2) return { erro: "Informe pelo menos 2 caracteres para buscar." };
      const digits = term.replace(/\D/g, "");
      const situation = args.situacao === "ativos" ? { active: true } : args.situacao === "inativos" ? { active: false } : {};
      const students = await prisma.user.findMany({
        where: { role: UserRole.STUDENT, ...situation, OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }] : [])] },
        select: studentSummarySelect, orderBy: { name: "asc" }, take: 10,
      });
      return {
        total: students.length,
        alunos: students.map((student) => ({
          id: student.id, nome: student.name, email: student.email, telefone: formatPhone(student.phone), conta: student.active ? "ativa" : "inativa",
          assinatura: student.subscription ? { situacao: paymentSituation(student.subscription), plano: student.subscription.planName, valor: formatCurrency(student.subscription.priceCents), proximaCobranca: day(student.subscription.nextBillingAt), cortesia: student.subscription.isCourtesy } : null,
        })),
      };
    },
  },
  {
    name: "ver_aluno",
    label: "Abriu o perfil do aluno",
    description: "Mostra o perfil completo de um aluno pelo id: contato, assinatura, termo de responsabilidade e últimos pagamentos.",
    parameters: { type: "object", properties: { id: { type: "string", description: "Id do aluno (vem de buscar_alunos)." } }, required: ["id"], additionalProperties: false },
    audiences: STAFF,
    allowed: can("students"),
    mutating: false,
    async run(args) {
      const id = text(args.id, 60);
      const student = await prisma.user.findFirst({
        where: { id, role: UserRole.STUDENT },
        include: { subscription: true, saleOwner: { select: { name: true } }, payments: { orderBy: { createdAt: "desc" }, take: 5 } },
      });
      if (!student) return { erro: "Aluno não encontrado." };
      const subscription = student.subscription;
      return {
        id: student.id, nome: student.name, email: student.email, telefone: formatPhone(student.phone), cpf: maskCpf(student.cpf),
        nascimento: day(student.birthDate), idade: calculateAge(student.birthDate), entrouEm: day(student.joinedAt), saiuEm: day(student.leftAt),
        conta: student.active ? "ativa" : "inativa", vendedor: student.saleOwner?.name ?? null,
        termoDeResponsabilidade: student.liabilityTermAcceptedAt ? `assinado em ${day(student.liabilityTermAcceptedAt)}` : student.liabilityTermStatus === "PENDING" ? "pendente" : student.liabilityTermStatus.toLowerCase(),
        assinatura: subscription ? { situacao: paymentSituation(subscription), plano: subscription.planName, valor: formatCurrency(subscription.priceCents), periodo: subscription.billingPeriod, proximaCobranca: day(subscription.nextBillingAt), metodos: subscription.allowedMethods.map(paymentMethodLabel), cortesia: subscription.isCourtesy } : null,
        ultimosPagamentos: student.payments.map((payment) => ({ valor: formatCurrency(payment.amountCents), situacao: paymentLabel(payment.status), metodo: paymentMethodLabel(payment.method), vencimento: day(payment.dueAt), pagoEm: day(payment.paidAt) })),
        perfil: profileUrl(student.id),
      };
    },
  },
  {
    name: "resumo_alunos",
    label: "Contou os alunos",
    description: "Números gerais dos alunos: contas ativas e inativas, assinaturas por situação e novos alunos no mês atual.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    audiences: STAFF,
    allowed: (context) => can("students")(context) || can("analysis")(context),
    mutating: false,
    async run() {
      const { year, month } = maceioDateParts();
      const now = new Date();
      const activeStudent = { role: UserRole.STUDENT, active: true };
      const [active, inactive, onTime, overdue, awaiting, courtesy, newThisMonth] = await Promise.all([
        prisma.user.count({ where: { role: UserRole.STUDENT, active: true } }),
        prisma.user.count({ where: { role: UserRole.STUDENT, active: false } }),
        prisma.user.count({ where: { ...activeStudent, subscription: { is: { status: SubscriptionStatus.ACTIVE, OR: [{ nextBillingAt: null }, { nextBillingAt: { gte: now } }] } } } }),
        prisma.user.count({ where: { ...activeStudent, subscription: { is: { OR: [{ status: SubscriptionStatus.PAST_DUE }, { nextBillingAt: { lt: now } }] } } } }),
        prisma.user.count({ where: { ...activeStudent, subscription: { is: { status: SubscriptionStatus.INCOMPLETE } } } }),
        prisma.user.count({ where: { ...activeStudent, subscription: { is: { isCourtesy: true } } } }),
        prisma.user.count({ where: { role: UserRole.STUDENT, joinedAt: { gte: maceioDayStart(year, month, 1) } } }),
      ]);
      return {
        contasAtivas: active, contasInativas: inactive, novosNoMes: newThisMonth,
        assinaturasDeContasAtivas: { emDia: onTime, emAtraso: overdue, aguardandoPagamento: awaiting, cortesias: courtesy },
        observacao: "Mesmos números de Analisar dados: em atraso inclui assinaturas ativas com vencimento já passado.",
      };
    },
  },
  {
    name: "listar_planos",
    label: "Consultou os planos",
    description: "Lista os planos ativos com serviço, período, preço e formas de pagamento.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    audiences: STAFF,
    allowed: (context) => can("plans")(context) || can("sales")(context) || can("students")(context),
    mutating: false,
    async run() {
      const plans = await prisma.plan.findMany({ where: { active: true, service: { active: true } }, include: { service: { select: { name: true } } }, orderBy: [{ service: { name: "asc" } }, { priceCents: "asc" }] });
      const periods: Record<string, string> = { MONTHLY: "mensal", QUARTERLY: "trimestral", SEMIANNUAL: "semestral", ANNUAL: "anual" };
      return { planos: plans.map((plan) => ({ servico: plan.service.name, periodo: periods[plan.period] ?? plan.period, preco: formatCurrency(plan.priceCents), metodos: plan.allowedMethods.map(paymentMethodLabel), destaque: plan.isFeatured })) };
    },
  },
  {
    name: "cadastrar_aluno",
    label: "Preparou um cadastro de aluno",
    description: "Prepara o cadastro de um novo aluno. Precisa de nome, e-mail, telefone com DDD e CPF; nascimento é opcional. Não cadastra na hora: a pessoa confirma no botão. Pergunte o que faltar antes de chamar.",
    parameters: { type: "object", properties: { nome: { type: "string" }, email: { type: "string" }, telefone: { type: "string", description: "Com DDD, só números ou formatado." }, cpf: { type: "string" }, nascimento: { type: "string", description: "AAAA-MM-DD (opcional)." } }, required: ["nome", "email", "telefone", "cpf"], additionalProperties: false },
    audiences: STAFF,
    allowed: can("students"),
    mutating: true,
    async prepare(args) {
      const validation = validateNewStudent({ name: args.nome, email: args.email, phone: args.telefone, cpf: args.cpf, birthDate: text(args.nascimento, 10) || undefined });
      if (!validation.ok) return { ok: false, error: validation.error };
      const conflict = await findStudentConflict(validation.data);
      if (conflict) return { ok: false, error: conflict };
      const data = validation.data;
      return {
        ok: true,
        input: { name: data.name, email: data.email, phone: data.phone, cpf: data.cpf, birthDate: data.birthDate ? text(args.nascimento, 10) : null },
        summary: `Cadastrar ${data.name} · ${data.email} · ${formatPhone(data.phone)} · CPF ${formatCpf(data.cpf)}${data.birthDate ? ` · nascimento ${day(data.birthDate)}` : ""}`,
      };
    },
    async execute(input, context) {
      const validation = validateNewStudent({ name: input.name, email: input.email, phone: input.phone, cpf: input.cpf, birthDate: typeof input.birthDate === "string" ? input.birthDate : undefined });
      if (!validation.ok) throw new Error(validation.error);
      const conflict = await findStudentConflict(validation.data);
      if (conflict) throw new Error(conflict);
      const created = await createStudentAccount(validation.data, context.actor.id);
      return {
        result: { alunoId: created.studentId, nome: created.name, email: created.email, perfil: profileUrl(created.studentId) },
        message: `${created.name} foi cadastrado. A senha temporária e o link de pagamento aparecem uma única vez no cartão desta ação.`,
        display: { "Senha temporária": created.temporaryPassword, "Link de pagamento": created.paymentUrl, Perfil: profileUrl(created.studentId) },
      };
    },
  },
  {
    name: "listar_agenda",
    label: "Consultou a agenda",
    description: "Lista os compromissos da agenda (demandas com data) dos quadros de que a pessoa participa. Sem datas, mostra de hoje até 14 dias à frente.",
    parameters: { type: "object", properties: { de: { type: "string", description: "AAAA-MM-DD" }, ate: { type: "string", description: "AAAA-MM-DD" }, incluir_concluidos: { type: "boolean" } }, additionalProperties: false },
    audiences: STAFF,
    allowed: can("demands"),
    mutating: false,
    async run(args, context) {
      const today = maceioDateParts();
      const from = parseDay(args.de)?.start ?? maceioDayStart(today.year, today.month, today.day);
      const untilDay = parseDay(args.ate);
      const to = untilDay ? maceioDayEnd(untilDay.year, untilDay.month, untilDay.day) : new Date(from.getTime() + 15 * 86_400_000 - 1);
      if (to < from) return { erro: "A data final vem antes da inicial." };
      const demands = await prisma.demand.findMany({
        where: { archivedAt: null, ...(args.incluir_concluidos === true ? {} : { completedAt: null }), scheduledAt: { gte: from, lte: to }, workArea: { members: { some: { userId: context.actor.id } } } },
        include: { workArea: { select: { name: true } }, assignees: { include: { user: { select: { name: true } } } } },
        orderBy: { scheduledAt: "asc" }, take: 50,
      });
      return {
        periodo: `${day(from)} a ${day(to)}`,
        compromissos: demands.map((demand) => ({ id: demand.id, titulo: demand.title, quando: when(demand.scheduledAt), quadro: demand.workArea.name, responsaveis: demand.assignees.map((item) => item.user.name), concluido: Boolean(demand.completedAt), descricao: demand.description?.slice(0, 280) ?? null })),
      };
    },
  },
  {
    name: "criar_evento_agenda",
    label: "Preparou um compromisso",
    description: "Prepara um compromisso na agenda (uma demanda com data e hora) num quadro de que a pessoa participa; ela fica como responsável. Não cria na hora: a pessoa confirma no botão. Se a pessoa participa de vários quadros e não disse qual, a ferramenta devolve as opções.",
    parameters: { type: "object", properties: { titulo: { type: "string" }, data_hora: { type: "string", description: "AAAA-MM-DDTHH:mm, horário de Maceió." }, descricao: { type: "string" }, quadro: { type: "string", description: "Nome do quadro (opcional)." } }, required: ["titulo", "data_hora"], additionalProperties: false },
    audiences: STAFF,
    allowed: can("demands"),
    mutating: true,
    async prepare(args, context) {
      const title = text(args.titulo, 140);
      const scheduledAt = parseLocalDateTime(args.data_hora);
      if (!title) return { ok: false, error: "Informe o título do compromisso." };
      if (!scheduledAt) return { ok: false, error: "Data e hora inválidas. Use AAAA-MM-DDTHH:mm." };
      const memberships = await prisma.workAreaMember.findMany({ where: { userId: context.actor.id }, include: { workArea: { include: { columns: { orderBy: { position: "asc" }, take: 1 } } } } });
      const areas = memberships.map((item) => item.workArea).filter((area) => area.columns.length > 0);
      if (!areas.length) return { ok: false, error: "A pessoa não participa de nenhum quadro de demandas com colunas." };
      const wanted = normalize(text(args.quadro, 80));
      const matches = wanted ? areas.filter((area) => normalize(area.name).includes(wanted)) : areas;
      const area = matches.length === 1 ? matches[0] : !wanted ? areas.find((item) => item.type === WorkAreaType.GENERAL) ?? (areas.length === 1 ? areas[0] : null) : null;
      if (!area) return { ok: false, error: `Em qual quadro? Opções: ${areas.map((item) => item.name).join(", ")}.` };
      const description = text(args.descricao, 3000);
      return {
        ok: true,
        input: { title, scheduledAt: scheduledAt.toISOString(), description: description || null, workAreaId: area.id, columnId: area.columns[0].id },
        summary: `Criar “${title}” em ${when(scheduledAt)} no quadro ${area.name}`,
      };
    },
    async execute(input, context) {
      const workAreaId = String(input.workAreaId);
      const membership = await prisma.workAreaMember.findUnique({ where: { workAreaId_userId: { workAreaId, userId: context.actor.id } }, select: { id: true } });
      if (!membership) throw new Error("Você não faz mais parte deste quadro.");
      const column = await prisma.workAreaColumn.findFirst({ where: { id: String(input.columnId), workAreaId } }) ?? await prisma.workAreaColumn.findFirst({ where: { workAreaId }, orderBy: { position: "asc" } });
      if (!column) throw new Error("O quadro não tem colunas.");
      const last = await prisma.demand.aggregate({ where: { workAreaId, columnId: column.id }, _max: { position: true } });
      const demand = await prisma.demand.create({
        data: { workAreaId, columnId: column.id, createdById: context.actor.id, title: String(input.title), description: typeof input.description === "string" ? input.description : null, scheduledAt: new Date(String(input.scheduledAt)), position: (last._max.position ?? -1) + 1, assignees: { create: { userId: context.actor.id } } },
        include: { workArea: { select: { name: true } } },
      });
      return { result: { id: demand.id, titulo: demand.title, quando: when(demand.scheduledAt), quadro: demand.workArea.name }, message: `Compromisso “${demand.title}” criado para ${when(demand.scheduledAt)} no quadro ${demand.workArea.name}.` };
    },
  },
  {
    name: "remover_evento_agenda",
    label: "Preparou a remoção de um compromisso",
    description: "Prepara a exclusão de um compromisso da agenda pelo id (use listar_agenda para achar). Não remove na hora: a pessoa confirma no botão.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
    audiences: STAFF,
    allowed: can("demands"),
    mutating: true,
    irreversible: true,
    async prepare(args, context) {
      const demand = await memberDemand(text(args.id, 60), context.actor.id);
      if (!demand) return { ok: false, error: "Compromisso não encontrado nos quadros desta pessoa." };
      return { ok: true, input: { id: demand.id }, summary: `Remover “${demand.title}”${demand.scheduledAt ? ` (${when(demand.scheduledAt)})` : ""} do quadro ${demand.workArea.name}` };
    },
    async execute(input, context) {
      const demand = await memberDemand(String(input.id), context.actor.id);
      if (!demand) throw new Error("O compromisso já foi removido ou você não faz mais parte do quadro.");
      await prisma.demand.delete({ where: { id: demand.id } });
      return { result: { id: demand.id, titulo: demand.title }, message: `Compromisso “${demand.title}” removido.` };
    },
  },
  {
    name: "resumo_financeiro",
    label: "Consultou o financeiro",
    description: "Resumo financeiro de um mês, com os mesmos números da tela Financeiro: entradas recebidas (planos, loja, outras), saídas (variáveis e fixas) e resultado projetado.",
    parameters: { type: "object", properties: { mes: { type: "string", description: "AAAA-MM. Padrão: mês atual." } }, additionalProperties: false },
    audiences: STAFF,
    allowed: can("finance"),
    mutating: false,
    async run(args) {
      const range = financeMonthRange(text(args.mes, 7) || undefined);
      const month = await loadFinanceMonth(range);
      return {
        mes: range.label,
        entradasRecebidas: formatCurrency(month.cashRevenue),
        entradas: { planos: formatCurrency(month.planCash), pagamentosDePlano: month.monthPayments.length, loja: formatCurrency(month.storeSales.totalCents), pedidosDaLoja: month.storeSales.count, outrasEntradas: formatCurrency(month.otherRevenue) },
        saidas: { total: formatCurrency(month.costs), variaveis: formatCurrency(month.monthCostsCents), fixas: formatCurrency(month.fixedCostsCents) },
        receitaContratadaDePlanos: formatCurrency(month.contractedPlanRevenue), contratosAtivos: month.activeContracts.length,
        resultadoProjetado: formatCurrency(month.projectedResult),
        observacao: "Resultado projetado = receita contratada dos planos + loja + outras entradas − saídas.",
      };
    },
  },
  {
    name: "listar_lancamentos",
    label: "Consultou os lançamentos",
    description: "Lista os lançamentos manuais do financeiro em um mês (entradas, saídas variáveis e custos fixos), com id para remoção.",
    parameters: { type: "object", properties: { mes: { type: "string", description: "AAAA-MM. Padrão: mês atual." }, tipo: { type: "string", enum: ["todos", "entradas", "saidas", "fixos"] } }, additionalProperties: false },
    audiences: STAFF,
    allowed: can("finance"),
    mutating: false,
    async run(args) {
      const range = financeMonthRange(text(args.mes, 7) || undefined);
      const { entries } = await loadFinanceMonth(range);
      const kind = args.tipo;
      const filtered = entries.filter((entry) => kind === "entradas" ? entry.type === FinancialEntryType.REVENUE : kind === "saidas" ? entry.type === FinancialEntryType.EXPENSE && !entry.isFixed : kind === "fixos" ? entry.isFixed : true);
      return {
        mes: range.label, total: filtered.length,
        lancamentos: filtered.slice(0, 40).map((entry) => ({ id: entry.id, titulo: entry.title, tipo: entry.type === FinancialEntryType.REVENUE ? "entrada" : entry.isFixed ? "custo fixo" : "saída", valor: formatCurrency(entry.amountCents), data: day(entry.occurredAt), categoria: entry.category, lancadoPor: entry.createdBy.name })),
      };
    },
  },
  {
    name: "lancar_financeiro",
    label: "Preparou um lançamento",
    description: "Prepara um lançamento manual no financeiro: entrada ou saída, com título, valor em reais e data. Custos fixos se repetem todo mês. Não lança na hora: a pessoa confirma no botão.",
    parameters: { type: "object", properties: { tipo: { type: "string", enum: ["entrada", "saida"] }, titulo: { type: "string" }, valor: { type: "number", description: "Em reais, ex.: 150.5" }, data: { type: "string", description: "AAAA-MM-DD. Padrão: hoje." }, categoria: { type: "string" }, descricao: { type: "string" }, fixo: { type: "boolean", description: "Repete todo mês (custo fixo ou entrada recorrente)." } }, required: ["tipo", "titulo", "valor"], additionalProperties: false },
    audiences: STAFF,
    allowed: isAdmin,
    mutating: true,
    async prepare(args) {
      const type = args.tipo === "entrada" ? FinancialEntryType.REVENUE : args.tipo === "saida" ? FinancialEntryType.EXPENSE : null;
      const title = text(args.titulo, 120);
      const cents = reais(args.valor);
      const today = maceioDateParts();
      const date = args.data ? parseDay(args.data) : { year: today.year, month: today.month, day: today.day, start: maceioDayStart(today.year, today.month, today.day) };
      if (!type) return { ok: false, error: "Diga se é entrada ou saída." };
      if (!title) return { ok: false, error: "Informe o título do lançamento." };
      if (!cents) return { ok: false, error: "Informe um valor válido, maior que zero." };
      if (!date) return { ok: false, error: "Data inválida. Use AAAA-MM-DD." };
      const isoDay = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
      const category = text(args.categoria, 60);
      const description = text(args.descricao, 1000);
      const fixed = args.fixo === true;
      return {
        ok: true,
        input: { type, title, amountCents: cents, day: isoDay, category: category || null, description: description || null, isFixed: fixed },
        summary: `${type === FinancialEntryType.REVENUE ? "Entrada" : "Saída"} de ${formatCurrency(cents)} · “${title}” em ${dateOnly.format(new Date(`${isoDay}T12:00:00-03:00`))}${category ? ` · ${category}` : ""}${fixed ? " · repete todo mês" : ""}`,
      };
    },
    async execute(input, context) {
      if (context.actor.role !== UserRole.ADMIN) throw new Error("Só administradores fazem lançamentos.");
      const entry = await prisma.financialEntry.create({
        data: { type: input.type === "REVENUE" ? FinancialEntryType.REVENUE : FinancialEntryType.EXPENSE, title: String(input.title), amountCents: Number(input.amountCents), occurredAt: new Date(`${String(input.day)}T12:00:00-03:00`), category: typeof input.category === "string" ? input.category : null, description: typeof input.description === "string" ? input.description : null, isFixed: input.isFixed === true, createdById: context.actor.id },
      });
      return { result: { id: entry.id, titulo: entry.title, valor: formatCurrency(entry.amountCents) }, message: `Lançamento “${entry.title}” de ${formatCurrency(entry.amountCents)} registrado.` };
    },
  },
  {
    name: "remover_lancamento",
    label: "Preparou a remoção de um lançamento",
    description: "Prepara a exclusão de um lançamento manual do financeiro pelo id (use listar_lancamentos). Não remove na hora: a pessoa confirma no botão.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
    audiences: STAFF,
    allowed: isAdmin,
    mutating: true,
    irreversible: true,
    async prepare(args) {
      const entry = await prisma.financialEntry.findUnique({ where: { id: text(args.id, 60) } });
      if (!entry) return { ok: false, error: "Lançamento não encontrado." };
      return { ok: true, input: { id: entry.id }, summary: `Remover “${entry.title}” (${formatCurrency(entry.amountCents)}, ${day(entry.occurredAt)})` };
    },
    async execute(input, context) {
      if (context.actor.role !== UserRole.ADMIN) throw new Error("Só administradores removem lançamentos.");
      const entry = await prisma.financialEntry.findUnique({ where: { id: String(input.id) } });
      if (!entry) throw new Error("O lançamento já foi removido.");
      await prisma.financialEntry.delete({ where: { id: entry.id } });
      return { result: { id: entry.id, titulo: entry.title }, message: `Lançamento “${entry.title}” removido.` };
    },
  },
  {
    name: "planos_disponiveis",
    label: "Consultou os planos",
    description: "Planos da assessoria com período, preço e formas de pagamento. Use quando perguntarem valores ou como contratar.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    audiences: PUBLIC,
    allowed: (context) => context.audience === AiAudience.STUDENT || (context.audience === AiAudience.LEAD && context.leadPrices),
    mutating: false,
    async run() {
      const plans = await prisma.plan.findMany({ where: { active: true, service: { active: true } }, include: { service: { select: { name: true } } }, orderBy: [{ service: { name: "asc" } }, { priceCents: "asc" }] });
      return { planos: plans.map((plan) => ({ servico: plan.service.name, periodo: periodLabels[plan.period] ?? plan.period, preco: formatCurrency(plan.priceCents), formasDePagamento: plan.allowedMethods.map(paymentMethodLabel) })), observacao: "Para contratar, a equipe faz o cadastro e envia o link de pagamento." };
    },
  },
  {
    name: "minha_assinatura",
    label: "Consultou a assinatura do aluno",
    description: "Situação da assinatura do próprio aluno que está conversando: plano, valor, próxima cobrança e último pagamento. Só funciona em conversa privada.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    audiences: [AiAudience.STUDENT],
    allowed: (context) => context.audience === AiAudience.STUDENT,
    mutating: false,
    async run(_args, context) {
      if (context.isGroup) return { erro: "Por privacidade, dados da assinatura só são informados no privado. Peça para a pessoa chamar no privado." };
      const student = await prisma.user.findFirst({ where: { id: context.actor.id, role: UserRole.STUDENT }, include: { subscription: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
      if (!student) return { erro: "Cadastro do aluno não encontrado." };
      const subscription = student.subscription;
      const last = student.payments[0];
      return {
        nome: student.name, conta: student.active ? "ativa" : "inativa",
        assinatura: subscription ? { situacao: paymentSituation(subscription), plano: subscription.planName, valor: formatCurrency(subscription.priceCents), periodo: periodLabels[subscription.billingPeriod] ?? subscription.billingPeriod, proximaCobranca: day(subscription.nextBillingAt) } : null,
        ultimoPagamento: last ? { valor: formatCurrency(last.amountCents), situacao: paymentLabel(last.status), vencimento: day(last.dueAt), pagoEm: day(last.paidAt) } : null,
        areaDoAluno: portalUrl("STUDENT", "/aluno"),
      };
    },
  },
  {
    name: "chamar_equipe",
    label: "Chamou a equipe",
    description: "Pede atendimento humano: quando a pessoa quer contratar, fechar plano, falar com o treinador, reclamar, ou quando você não souber responder. Marca a conversa para a equipe e avisa quem estiver de plantão.",
    parameters: { type: "object", properties: { motivo: { type: "string", description: "Em uma frase, o que a pessoa precisa." } }, required: ["motivo"], additionalProperties: false },
    audiences: PUBLIC,
    allowed: (context) => context.audience !== AiAudience.STAFF,
    mutating: false,
    async run(args, context) {
      const reason = text(args.motivo, 240) || "Pediu para falar com a equipe";
      const conversation = await prisma.aiConversation.update({ where: { id: context.conversationId }, data: { needsHuman: true, needsHumanReason: reason } });
      const who = context.audience === AiAudience.STUDENT ? "Aluno" : "Lead";
      const name = context.contact?.name || conversation.contactName || "sem nome";
      const phone = context.contact?.phone ? formatWhatsapp(context.contact.phone) : "";
      await notifyTeam(`Atendimento pedido pelo WhatsApp\n${who}: ${name}${phone ? ` · ${phone}` : ""}\nMotivo: ${reason}\nConversa: ${managementAppUrl()}/admin/assistente/whatsapp?c=${conversation.id}`);
      return { status: "equipe_avisada", orientacao: "Diga que a equipe da Pace Lab já foi avisada e vai responder por aqui em breve." };
    },
  },
];

export function toolsFor(context: ToolContext) {
  if (context.restricted) return [];
  return tools.filter((tool) => tool.audiences.includes(context.audience) && tool.allowed(context));
}

export function findTool(name: string) {
  return tools.find((tool) => tool.name === name) ?? null;
}

export function toolLabel(name: string | null | undefined) {
  return (name && findTool(name)?.label) || "Consultou dados";
}

export function toolDefinitions(list: AssistantTool[]): ToolDefinition[] {
  return list.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
}

// Para avisar no prompt o que a pessoa não pode pedir.
export function deniedAreas(context: ToolContext) {
  const allowed = new Set(toolsFor(context).map((tool) => tool.name));
  return tools.filter((tool) => tool.audiences.includes(context.audience) && !allowed.has(tool.name)).map((tool) => tool.name);
}
