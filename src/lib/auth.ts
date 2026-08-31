import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/tokens";

export const SESSION_COOKIE = "pabula_session";
const SECURE_SESSION_COOKIE = "__Host-pabula_session";
const SESSION_DAYS = 30;
const DUMMY_PASSWORD_HASH = "$2b$12$lv3TuqeJTudJVUBnpLI.Q.hwS2EH.ZwxC6GkJzwFO5QhLhqluIMrW";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tutorialSeenAt: Date | null;
};

function isSecureRequest(request?: Request) {
  if (!request) return process.env.NODE_ENV === "production";
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return forwardedProto === "https" || new URL(request.url).protocol === "https:";
}

function getSessionCookieValue(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore.get(SECURE_SESSION_COOKIE)?.value ?? cookieStore.get(SESSION_COOKIE)?.value;
}

export async function verifyCredentials(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const isValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!isValid) return null;
  if (!user || !user.active) return null;

  return user;
}

export async function createSession(userId: string, request?: Request) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.session.create({ data: { tokenHash: hashOpaqueToken(token), userId, expiresAt } });

  const cookieStore = await cookies();
  const secure = isSecureRequest(request);
  cookieStore.set(secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = getSessionCookieValue(cookieStore);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashOpaqueToken(token) } });
  cookieStore.delete(SECURE_SESSION_COOKIE);
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = getSessionCookieValue(cookieStore);
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    tutorialSeenAt: session.user.tutorialSeenAt,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: UserRole) {
  const user = await requireUser();
  if (user.role !== role) redirect(user.role === UserRole.ADMIN ? "/admin" : "/aluno");
  return user;
}
