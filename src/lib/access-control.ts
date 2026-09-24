export const managerFeatures = ["overview", "demands", "sales", "students", "analysis", "finance", "plans", "integrations"] as const;
export type ManagerFeature = typeof managerFeatures[number];

export function canAccessFeature(user: { role: string; managerPermissions: unknown }, feature: ManagerFeature) {
  if (user.role === "ADMIN") return true;
  if (user.role === "OPERATOR") return ["demands", "sales", "students", "analysis"].includes(feature);
  if (user.role !== "MANAGER") return false;
  return Boolean(user.managerPermissions && typeof user.managerPermissions === "object" && !Array.isArray(user.managerPermissions) && (user.managerPermissions as Record<string, unknown>)[feature] === true);
}
