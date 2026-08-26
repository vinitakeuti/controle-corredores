export function normalizeCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export function isValidCpf(value: string | null) {
  if (!value || value.length !== 11 || /^([0-9])\1+$/.test(value)) return false;
  const digitAt = (length: number) => {
    const total = value.slice(0, length).split("").reduce((sum, digit, index) => sum + Number(digit) * (length + 1 - index), 0);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digitAt(9) === Number(value[9]) && digitAt(10) === Number(value[10]);
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
