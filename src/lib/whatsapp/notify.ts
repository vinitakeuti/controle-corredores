import { getWhatsAppRecord, evolutionConfigFrom } from "@/lib/whatsapp/settings";
import { sendText } from "@/lib/whatsapp/evolution";
import { toWhatsappNumber } from "@/lib/whatsapp/phone";

// Avisa a equipe (um número ou um grupo configurado em Integrações) que alguém pediu atendimento humano.
export async function notifyTeam(text: string) {
  const record = await getWhatsAppRecord();
  const config = evolutionConfigFrom(record);
  const target = record?.teamNotifyTarget?.trim();
  if (!record?.enabled || !config || !target) return false;
  const to = target.includes("@") ? target : toWhatsappNumber(target);
  if (!to) return false;
  try {
    await sendText(config, to, text);
    return true;
  } catch (error) {
    console.error("team notification failed", error);
    return false;
  }
}
