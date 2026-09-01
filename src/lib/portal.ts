import { UserRole } from "@prisma/client";

export type Portal = "MANAGEMENT" | "STUDENT" | "UNKNOWN";

const DEFAULT_MANAGEMENT_URL = "https://gestao.pacelabcoaching.com";
const DEFAULT_STUDENT_URL = "https://alunos.pacelabcoaching.com";

function originFrom(value: string, fallback: string) {
  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

function hostnameFrom(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new URL(`http://${value}`).hostname.toLowerCase();
  } catch {
    return value.split(":")[0].toLowerCase();
  }
}

export function managementAppUrl() {
  return originFrom(process.env.ADMIN_APP_URL ?? process.env.APP_URL ?? DEFAULT_MANAGEMENT_URL, DEFAULT_MANAGEMENT_URL);
}

export function studentAppUrl() {
  return originFrom(process.env.STUDENT_APP_URL ?? DEFAULT_STUDENT_URL, DEFAULT_STUDENT_URL);
}

export function isStudentPortalEnabled() {
  return process.env.STUDENT_PORTAL_ENABLED?.trim().toLowerCase() === "true"
    && new URL(managementAppUrl()).hostname !== new URL(studentAppUrl()).hostname;
}

export function canonicalStudentAppUrl() {
  return isStudentPortalEnabled() ? studentAppUrl() : managementAppUrl();
}

export function portalUrl(portal: Exclude<Portal, "UNKNOWN">, path = "/") {
  const base = portal === "STUDENT" ? canonicalStudentAppUrl() : managementAppUrl();
  return new URL(path, base).toString();
}

export function portalUrlForRole(role: UserRole, path: string) {
  return portalUrl(role === UserRole.STUDENT ? "STUDENT" : "MANAGEMENT", path);
}

export function portalForHost(host: string | null | undefined): Portal {
  const hostname = hostnameFrom(host);
  if (!hostname) return "UNKNOWN";
  if (hostname === new URL(managementAppUrl()).hostname) return "MANAGEMENT";
  if (isStudentPortalEnabled() && hostname === new URL(studentAppUrl()).hostname) return "STUDENT";
  return "UNKNOWN";
}
