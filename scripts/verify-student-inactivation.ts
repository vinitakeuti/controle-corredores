// Run only against an isolated local verification schema and app instance.
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { processAppmaxGatewayEvent } from "../src/lib/appmax-webhook";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
assert(["127.0.0.1", "localhost", "[::1]"].includes(databaseUrl.hostname), "Verification must use a local database.");
assert(databaseUrl.searchParams.get("schema")?.startsWith("verification_"), "Use a dedicated verification_ schema.");
const baseUrl = process.env.VERIFICATION_BASE_URL ?? "http://127.0.0.1:3107";
assert(["127.0.0.1", "localhost"].includes(new URL(baseUrl).hostname), "Verification must use a local app.");
const password = "Review-Pace-2026!";

async function seed() {
  const passwordHash = await bcrypt.hash(password, 10);
  const users = [];
  for (const [key, name, role] of [
    ["admin", "Admin de verificação", "ADMIN"],
    ["operator", "Operador de verificação", "OPERATOR"],
    ["manager", "Gerente de verificação", "MANAGER"],
    ["student", "Aluno de verificação", "STUDENT"],
    ["courtesy", "Cortesia de verificação", "STUDENT"],
    ["no-plan", "Aluno sem plano", "STUDENT"],
  ] as const) {
    const data = { name, role, passwordHash, active: true, leftAt: null, tutorialSeenAt: new Date() };
    users.push(await prisma.user.upsert({ where: { email: `review.${key}@example.test` }, create: { email: `review.${key}@example.test`, ...data }, update: data }));
  }
  const [admin, operator, manager, student, courtesy, noPlan] = users;
  const service = await prisma.service.upsert({ where: { name: "Treino de verificação" }, create: { name: "Treino de verificação" }, update: {} });
  const plan = await prisma.plan.upsert({ where: { serviceId_period: { serviceId: service.id, period: "MONTHLY" } }, create: { serviceId: service.id, period: "MONTHLY", priceCents: 15000 }, update: {} });
  for (const account of [student, courtesy]) {
    const data = { status: "ACTIVE" as const, planId: plan.id, priceCents: 15000, nextBillingAt: new Date("2026-01-01T12:00:00Z"), isCourtesy: account.id === courtesy.id, manualMonthlyBilling: account.id === student.id, recurringEnabled: false };
    await prisma.subscription.upsert({ where: { userId: account.id }, create: { userId: account.id, ...data }, update: data });
  }
  return { admin, operator, manager, student, courtesy, noPlan };
}

async function request(path: string, options: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  return fetch(new URL(path, baseUrl), { method: options.method ?? "GET", headers: { Origin: baseUrl, ...(options.body === undefined ? {} : { "Content-Type": "application/json" }), ...(options.cookie ? { Cookie: options.cookie } : {}), ...options.headers }, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }), redirect: "manual" });
}

async function login(email: string) {
  const response = await request("/api/auth/login", { method: "POST", body: { email, password } });
  assert.equal(response.status, 200, await response.clone().text());
  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  assert(cookie, "Login must issue a session cookie.");
  return cookie;
}

async function run() {
  const users = await seed();
  if (process.argv.includes("--seed")) {
    console.log("Isolated fixtures ready. Synthetic login: review.admin@example.test / Review-Pace-2026!");
    return;
  }
  const adminCookie = await login(users.admin.email);
  const operatorCookie = await login(users.operator.email);
  const managerCookie = await login(users.manager.email);
  const studentCookie = await login(users.student.email);
  const path = `/api/admin/students/${users.student.id}`;
  for (const cookie of [operatorCookie, managerCookie, studentCookie]) {
    const response = await request(path, { method: "PATCH", cookie, body: { action: "set-active", active: false } });
    assert.equal(response.status, 403, "Only admins can inactivate students.");
  }
  assert.equal((await request(path, { method: "PATCH", cookie: adminCookie, body: { action: "set-active", active: false }, headers: { Origin: "https://other.example.test" } })).status, 403);
  assert.equal((await request(path, { method: "PATCH", cookie: adminCookie, body: null })).status, 400);
  console.log("PASS permissions, origin and malformed request checks");

  const subscription = await prisma.subscription.findUniqueOrThrow({ where: { userId: users.student.id } });
  const historicalPayment = await prisma.payment.create({ data: { userId: users.student.id, subscriptionId: subscription.id, status: "PAID", amountCents: 15000, method: "PIX", dueAt: new Date(), paidAt: new Date() } });
  const link = await prisma.paymentLink.create({ data: { tokenHash: `verification-${crypto.randomUUID()}`, userId: users.student.id, createdById: users.admin.id } });
  assert.equal((await request(path, { method: "PATCH", cookie: adminCookie, body: { action: "set-active", active: false } })).status, 200);
  const inactive = await prisma.user.findUniqueOrThrow({ where: { id: users.student.id }, include: { subscription: true } });
  assert.equal(inactive.active, false);
  assert(inactive.leftAt);
  assert.equal(inactive.subscription?.status, "CANCELED");
  assert.equal(inactive.subscription.nextBillingAt, null);
  assert.equal((await prisma.paymentLink.findUniqueOrThrow({ where: { id: link.id } })).status, "REVOKED");
  assert(await prisma.payment.findUnique({ where: { id: historicalPayment.id } }), "Historical payments must survive inactivation.");
  assert.equal(await prisma.session.count({ where: { userId: inactive.id } }), 0);
  assert.equal(await prisma.user.count({ where: { id: inactive.id, active: true, subscription: { is: { OR: [{ status: "PAST_DUE" }, { nextBillingAt: { lt: new Date() } }] } } } }), 0);
  console.log("PASS inactivation, revoked sessions/links, historical payments and overdue exclusion");

  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: users.student.email, password: "wrong-password" } })).status, 401);
  const limitedCookie = await login(users.student.email);
  const studentPage = await request("/aluno", { cookie: limitedCookie });
  assert.equal(studentPage.status, 200);
  const html = await studentPage.text();
  assert(html.includes("Sua conta está inativa."));
  assert(html.includes("suporte da Pace Lab"));
  assert(html.includes('href="https://loja.pacelabcoaching.com"'));
  assert(!html.includes("GERAR PIX"));
  for (const endpoint of ["/api/payments", "/api/student/plan"]) {
    const response = await request(endpoint, { method: endpoint.endsWith("plan") ? "PATCH" : "POST", cookie: limitedCookie, body: {} });
    assert([401, 403].includes(response.status), `${endpoint} must reject inactive accounts.`);
  }
  assert.equal((await request(path, { method: "PATCH", cookie: limitedCookie, body: { action: "set-active", active: true } })).status, 403);
  assert.equal((await request("/login", { cookie: limitedCookie })).status, 307);
  assert.equal((await request("/api/store/student-login", { method: "POST", headers: { "x-store-auth-secret": process.env.STORE_AUTH_SHARED_SECRET ?? "" }, body: { email: users.student.email, password } })).status, 200);
  console.log("PASS limited login, account notice, store access and blocked plan/payment APIs");

  await prisma.subscription.update({ where: { id: subscription.id }, data: { providerSubscriptionId: `verification-${subscription.id}`, manualMonthlyBilling: false } });
  const event = await prisma.gatewayEvent.create({ data: { eventKey: `verification-${crypto.randomUUID()}`, eventName: "subscription_charge_success", eventType: "subscription", providerSubscriptionId: `verification-${subscription.id}`, amountCents: 15000 } });
  await processAppmaxGatewayEvent(event.id);
  assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status, "CANCELED");
  assert(await prisma.payment.findUnique({ where: { requestKey: `appmax:${event.eventKey}` } }), "A late confirmed payment must still be recorded.");
  assert.equal((await prisma.gatewayEvent.findUniqueOrThrow({ where: { id: event.id } })).status, "PROCESSED");
  console.log("PASS late webhook preserves the payment without reactivating the student");

  assert.equal((await request(path, { method: "PATCH", cookie: adminCookie, body: { action: "set-active", active: true } })).status, 200);
  const reactivated = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
  assert.equal(reactivated.status, "INCOMPLETE");
  assert.equal(reactivated.nextBillingAt, null);
  assert.equal(reactivated.recurringEnabled, false);
  assert.equal(reactivated.automaticPixEnabled, true);
  for (const active of [false, true]) assert.equal((await request(`/api/admin/students/${users.courtesy.id}`, { method: "PATCH", cookie: adminCookie, body: { action: "set-active", active } })).status, 200);
  assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { userId: users.courtesy.id } })).status, "ACTIVE");
  assert.equal((await request(`/api/admin/students/${users.noPlan.id}`, { method: "PATCH", cookie: adminCookie, body: { action: "set-active", active: false } })).status, 200);
  assert.equal((await request(`/api/admin/students/${users.noPlan.id}`, { method: "PATCH", cookie: adminCookie, body: { action: "set-active", active: false } })).status, 200);
  console.log("PASS reactivation without instant overdue, courtesy preservation and accounts without plans");
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
