import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WhatsAppInbox } from "@/components/whatsapp-inbox";
import { requireFeature } from "@/lib/auth";
import { canUseWhatsAppInbox, listWhatsAppConversations, loadWhatsAppView } from "@/lib/whatsapp/inbox";
import { evolutionConfigFrom, getWhatsAppRecord } from "@/lib/whatsapp/settings";
import { getAssistantName } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

export default async function WhatsAppInboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await requireFeature("assistant");
  if (!canUseWhatsAppInbox(user)) redirect("/admin/sem-acesso");
  const params = await searchParams;
  const [page, view, record, assistantName] = await Promise.all([
    listWhatsAppConversations({}),
    params.c ? loadWhatsAppView(params.c) : Promise.resolve(null),
    getWhatsAppRecord(),
    getAssistantName(),
  ]);
  return (
    <AppShell user={user} current="assistant">
      <WhatsAppInbox initialPage={page} initialView={view} connected={Boolean(record?.enabled && evolutionConfigFrom(record))} assistantName={assistantName} />
    </AppShell>
  );
}
