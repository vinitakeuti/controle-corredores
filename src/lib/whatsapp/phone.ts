// Números do WhatsApp. A Evolution manda "5582999991234@s.whatsapp.net" (direto),
// "1203...@g.us" (grupo) ou "...@lid" (identificador interno, sem número).

export const digitsOnly = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export function jidUser(jid: string) {
  return jid.split("@")[0].split(":")[0];
}

export const isGroupJid = (jid: string) => jid.endsWith("@g.us");
export const isLidJid = (jid: string) => jid.endsWith("@lid");
export const isIgnoredJid = (jid: string) => jid === "status@broadcast" || jid.endsWith("@broadcast") || jid.endsWith("@newsletter");

// Número completo com DDI, como a Evolution espera. Sem DDI e com 10 ou 11 dígitos, assume Brasil.
export function toWhatsappNumber(value: string | null | undefined) {
  const digits = digitsOnly(value);
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : null;
}

// Chave para comparar números do Brasil com ou sem DDI e com ou sem o nono dígito:
// DDD + os 8 últimos dígitos. Números de outros países ficam como estão.
export function phoneKey(value: string | null | undefined) {
  let digits = digitsOnly(value);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) return `${digits.slice(0, 2)}${digits.slice(-8)}`;
  return digits.length >= 8 ? digits : null;
}

export function formatWhatsapp(value: string | null | undefined) {
  const digits = digitsOnly(value);
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits ? `+${digits}` : "";
}
