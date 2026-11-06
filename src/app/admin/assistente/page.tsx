import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { AssistantChat } from "@/components/assistant-chat";
import { loadConversationView, staffContext } from "@/lib/ai/agent";
import { listConversations } from "@/lib/ai/conversations";
import { getAiApiKey, getAiSettingsSummary } from "@/lib/ai/settings";
import { toolsFor } from "@/lib/ai/tools";
import { requireFeature } from "@/lib/auth";
import { greetingForDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canUseWhatsAppInbox } from "@/lib/whatsapp/inbox";
import { AiChannel } from "@prisma/client";

export const dynamic = "force-dynamic";

// Sugestões só do que a pessoa pode pedir.
const suggestionByTool: Record<string, string> = {
  listar_agenda: "Meus compromissos desta semana",
  resumo_financeiro: "Como está o financeiro do mês?",
  resumo_alunos: "Quantos alunos ativos temos?",
  cadastrar_aluno: "Cadastrar um aluno novo",
  lancar_financeiro: "Lançar uma saída",
};

// Frase de apresentação montada com o que este perfil realmente pode fazer.
function capabilities(tools: string[]) {
  const parts: string[] = [];
  if (tools.includes("cadastrar_aluno")) parts.push("consultar e cadastrar alunos");
  else if (tools.includes("buscar_alunos")) parts.push("consultar alunos");
  if (tools.includes("criar_evento_agenda")) parts.push("cuidar da sua agenda");
  else if (tools.includes("listar_agenda")) parts.push("consultar a agenda");
  if (tools.includes("lancar_financeiro")) parts.push("acompanhar o financeiro e fazer lançamentos");
  else if (tools.includes("resumo_financeiro")) parts.push("acompanhar o financeiro");
  if (!parts.length) return "Posso tirar dúvidas sobre a Pace Lab.";
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : parts[0];
  const changes = tools.some((tool) => ["cadastrar_aluno", "criar_evento_agenda", "remover_evento_agenda", "lancar_financeiro", "remover_lancamento"].includes(tool));
  return `Posso ${list}.${changes ? " Alterações esperam a sua confirmação." : ""}`;
}

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await requireFeature("assistant");
  const params = await searchParams;
  const [settings, apiKey, history, initialView] = await Promise.all([
    getAiSettingsSummary(),
    getAiApiKey(),
    listConversations(user.id),
    params.c ? loadConversationView(params.c, user.id) : Promise.resolve(null),
  ]);
  const ready = settings.enabled && Boolean(apiKey) && Boolean(settings.model);
  const notReadyReason = ready ? null : !apiKey ? "O assistente ainda não tem a chave do OpenRouter." : !settings.model ? "O assistente ainda não tem um modelo escolhido." : "O assistente está desligado.";
  const available = toolsFor({ ...staffContext(user), conversationId: "" }).map((tool) => tool.name);
  const suggestions = Object.entries(suggestionByTool).filter(([tool]) => available.includes(tool)).map(([, text]) => text).slice(0, 4);
  const isAdmin = user.role === UserRole.ADMIN;
  const whatsappTab = canUseWhatsAppInbox(user) ? { count: await prisma.aiConversation.count({ where: { channel: AiChannel.WHATSAPP, archivedAt: null, needsHuman: true } }) } : null;

  return (
    <AppShell user={user} current="assistant">
      <AssistantChat
        greeting={`${greetingForDate()}, ${user.name.split(" ")[0]}.`}
        intro={`${settings.assistantName ? `Sou ${settings.assistantName}, assistente da Pace Lab.` : "Sou o assistente da Pace Lab."} ${capabilities(available)}`}
        assistantName={settings.assistantName || null}
        ready={ready}
        notReadyReason={notReadyReason ? `${notReadyReason}${isAdmin ? "" : " Fale com um administrador."}` : null}
        isAdmin={isAdmin}
        modelId={settings.model}
        suggestions={suggestions}
        initialHistory={history}
        initialView={initialView}
        whatsappTab={whatsappTab}
      />
    </AppShell>
  );
}
