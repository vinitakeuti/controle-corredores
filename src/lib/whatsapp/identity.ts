import { AiAudience, UserRole } from "@prisma/client";
import { canAccessFeature } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { phoneKey } from "@/lib/whatsapp/phone";

type Person = { id: string; name: string; role: UserRole; managerPermissions: unknown };
export type Identity =
  | { audience: typeof AiAudience.STAFF; user: Person; label: string; allowed: boolean }
  | { audience: typeof AiAudience.STUDENT; user: Person; label: string }
  | { audience: typeof AiAudience.LEAD; user: null; label: string };

const staffLabels: Record<string, string> = { ADMIN: "administrador(a)", MANAGER: "gerente", OPERATOR: "operador(a)" };
const firstName = (name: string) => name.split(" ")[0];

// Quem está falando, pelo número:
// 1) equipe: número cadastrado no assistente (Configurações › Assistente IA), com o cargo de cada um;
// 2) aluno: telefone do cadastro; 3) qualquer outro número é lead.
export async function identifyByPhone(phone: string | null, pushName: string | null): Promise<Identity> {
  const key = phoneKey(phone);
  if (key) {
    const last8 = key.slice(-8);
    const staff = (await prisma.user.findMany({
      where: { assistantWhatsapp: { endsWith: last8 }, active: true, role: { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] } },
      select: { id: true, name: true, role: true, managerPermissions: true, assistantWhatsapp: true },
    })).find((user) => phoneKey(user.assistantWhatsapp) === key);
    if (staff) {
      return { audience: AiAudience.STAFF, user: staff, label: `${firstName(staff.name)} · ${staffLabels[staff.role] ?? "equipe"}`, allowed: canAccessFeature(staff, "assistant") };
    }
    const student = (await prisma.user.findMany({
      where: { role: UserRole.STUDENT, phone: { endsWith: last8 } },
      select: { id: true, name: true, role: true, managerPermissions: true, phone: true, active: true },
      orderBy: { active: "desc" },
    })).find((user) => phoneKey(user.phone) === key);
    if (student) return { audience: AiAudience.STUDENT, user: student, label: `${firstName(student.name)} · aluno(a)` };
  }
  return { audience: AiAudience.LEAD, user: null, label: `${pushName ? firstName(pushName) : "Contato"} · lead` };
}
