import { PrismaClient, PaymentMethod, PaymentStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
}

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo seed bloqueado em produção. Defina ALLOW_DEMO_SEED=true apenas conscientemente.");
  }

  const adminPassword = await bcrypt.hash("Admin@123", 12);
  const studentPassword = await bcrypt.hash("Aluno@123", 12);
  const now = new Date();
  const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const inTwentyDays = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000);

  const admin = await prisma.user.upsert({
    where: { email: "admin@pabula.com" },
    update: { passwordHash: adminPassword, role: UserRole.ADMIN, active: true },
    create: { name: "Admin Pace Lab", email: "admin@pabula.com", passwordHash: adminPassword, role: UserRole.ADMIN },
  });

  const student = await prisma.user.upsert({
    where: { email: "aluno@pabula.com" },
    update: { passwordHash: studentPassword, role: UserRole.STUDENT, active: true, phone: "82999990001", cpf: "12345678909", birthDate: new Date("1995-04-12") },
    create: { name: "Ana Corredora", email: "aluno@pabula.com", passwordHash: studentPassword, role: UserRole.STUDENT, joinedAt: lastMonth, phone: "82999990001", cpf: "12345678909", birthDate: new Date("1995-04-12") },
  });

  await prisma.payment.deleteMany({ where: { userId: student.id } });
  await prisma.subscription.deleteMany({ where: { userId: student.id } });
  const studentSubscription = await prisma.subscription.create({ data: { userId: student.id, status: SubscriptionStatus.ACTIVE, nextBillingAt: inFiveDays, priceCents: 15000 } });

  const pastDueStudent = await prisma.user.upsert({
    where: { email: "carlos@pabula.com" },
    update: { passwordHash: studentPassword, role: UserRole.STUDENT, active: true, phone: "82999990002", cpf: "98765432100", birthDate: new Date("1990-09-27") },
    create: { name: "Carlos Velocista", email: "carlos@pabula.com", passwordHash: studentPassword, role: UserRole.STUDENT, joinedAt: lastMonth, phone: "82999990002", cpf: "98765432100", birthDate: new Date("1990-09-27") },
  });
  await prisma.payment.deleteMany({ where: { userId: pastDueStudent.id } });
  await prisma.subscription.deleteMany({ where: { userId: pastDueStudent.id } });
  const pastDueSubscription = await prisma.subscription.create({ data: { userId: pastDueStudent.id, status: SubscriptionStatus.PAST_DUE, nextBillingAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), priceCents: 15000 } });

  await prisma.payment.create({
    data: { userId: pastDueStudent.id, subscriptionId: pastDueSubscription.id, amountCents: 15000, method: PaymentMethod.PIX, status: PaymentStatus.PENDING, dueAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
  });

  await prisma.payment.create({
    data: { userId: student.id, subscriptionId: studentSubscription.id, amountCents: 15000, method: PaymentMethod.CARD, status: PaymentStatus.PAID, dueAt: lastMonth, paidAt: lastMonth },
  });

  console.log(`Seed concluído para ${admin.email} e usuários de demonstração.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
