export const managerFeatures = ["overview", "demands", "sales", "students", "analysis", "finance", "plans", "integrations"] as const;
export type ManagerFeature = typeof managerFeatures[number];

export function canAccessFeature(user: { role: string; managerPermissions: unknown }, feature: ManagerFeature) {
  if (user.role === "ADMIN") return true;
  if (user.role === "OPERATOR") return ["demands", "sales", "students", "analysis"].includes(feature);
  if (user.role !== "MANAGER") return false;
  return Boolean(user.managerPermissions && typeof user.managerPermissions === "object" && !Array.isArray(user.managerPermissions) && (user.managerPermissions as Record<string, unknown>)[feature] === true);
}

// Administradores sempre podem; os demais precisam da permissão definida em
// Configurações e de acesso à área de alunos, onde o link é gerado.
export function canGeneratePasswordResetLink(user: { role: string; managerPermissions: unknown; passwordResetLinkAccess: boolean }) {
  if (!canAccessFeature(user, "students")) return false;
  return user.role === "ADMIN" || user.passwordResetLinkAccess;
}
