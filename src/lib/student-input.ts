export function normalizeCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export function isValidCpf(value: string | null) {
  return value === null || (value.length === 11 && !/^([0-9])\1+$/.test(value));
}

export function isValidPhone(value: string | null) {
  return value === null || (value.length >= 10 && value.length <= 13);
}

export function parseBirthDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime()) || date > new Date()) return null;
  return date;
}
