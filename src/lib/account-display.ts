// Como mostrar a conta em telas de senha (redefinir e primeiro acesso).

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "corredor";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "PL";
}

// Quem recebe o link reconhece a própria conta sem expor o e-mail completo.
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? `${local[0]}•••` : `${local.slice(0, 2)}•••${local.slice(-1)}`;
  return `${visible}@${domain}`;
}
