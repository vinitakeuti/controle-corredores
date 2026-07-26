import { PrismaClient, PaymentMethod, PaymentStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin@123", 12);
  const studentPassword = await bcrypt.hash("Aluno@123", 12);
  const now = new Date();
  const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const inTwentyDays = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000);

  const admin = await prisma.user.upsert({
    where: { email: "admin@pabula.com" },
    update: { passwordHash: adminPassword, role: UserRole.ADMIN, active: true },
    create: { name: "Admin Pabula", email: "admin@pabula.com", passwordHash: adminPassword, role: UserRole.ADMIN },
  });

  const student = await prisma.user.upsert({
    where: { email: "aluno@pabula.com" },
    update: { passwordHash: studentPassword, role: UserRole.STUDENT, active: true },
    create: { name: "Ana Corredora", email: "aluno@pabula.com", passwordHash: studentPassword, role: UserRole.STUDENT, joinedAt: lastMonth },
  });

  const studentSubscription = await prisma.subscription.upsert({
    where: { userId: student.id },
    update: { status: SubscriptionStatus.ACTIVE, nextBillingAt: inFiveDays },
    create: { userId: student.id, status: SubscriptionStatus.ACTIVE, nextBillingAt: inFiveDays, priceCents: 15000 },
  });

  const pastDueStudent = await prisma.user.upsert({
    where: { email: "carlos@pabula.com" },
    update: { passwordHash: studentPassword, role: UserRole.STUDENT, active: true },
    create: { name: "Carlos Velocista", email: "carlos@pabula.com", passwordHash: studentPassword, role: UserRole.STUDENT, joinedAt: lastMonth },
  });
  const pastDueSubscription = await prisma.subscription.upsert({
    where: { userId: pastDueStudent.id },
    update: { status: SubscriptionStatus.PAST_DUE, nextBillingAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
    create: { userId: pastDueStudent.id, status: SubscriptionStatus.PAST_DUE, nextBillingAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), priceCents: 15000 },
  });

  await prisma.payment.deleteMany({ where: { userId: pastDueStudent.id } });
  await prisma.payment.create({
    data: { userId: pastDueStudent.id, subscriptionId: pastDueSubscription.id, amountCents: 15000, method: PaymentMethod.PIX, status: PaymentStatus.PENDING, dueAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
  });

  await prisma.payment.deleteMany({ where: { userId: student.id } });
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
