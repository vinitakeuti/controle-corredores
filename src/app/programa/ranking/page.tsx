import { AppShell } from "@/components/app-shell";
import { RankingBoard } from "@/components/program-ranking";
import { PageHeader } from "@/components/ui/page-header";
import { currentMonthKey, monthName, monthRanking } from "@/lib/influencers";
import { requireProgramMember } from "@/lib/program";

export default async function ProgramRankingPage() {
  const { user, influencer } = await requireProgramMember();
  const month = currentMonthKey();
  const ranking = await monthRanking(month);
  const me = ranking.find((row) => row.influencerId === influencer.id);
  // Próximo alvo: o grupo de pontos logo acima do seu.
  const above = me ? ranking.filter((row) => row.points > me.points).at(-1) : ranking.at(-1);
  const passing = above ? ranking.filter((row) => row.points === above.points) : [];
  const missing = above ? above.points - (me?.points ?? 0) + 1 : 0;

  return <AppShell user={user} current="program-ranking">
    <PageHeader context={{ label: "Programa Experts & Creators" }} title="Ranking." lead={`Experts e Creators em ${monthName(month)}. 1 venda com o seu cupom = 1 ponto. Empate divide a posição.`} />
    {above ? <p className="message ranking-target" data-tone="info" role="status"><span>{me ? `Faltam ${missing} ${missing === 1 ? "ponto" : "pontos"} para passar ${passing[0].name}${passing.length > 1 ? ` e mais ${passing.length - 1}` : ""} (${above.position}º).` : "Sua primeira venda do mês já te coloca no ranking."}</span></p> : me ? <p className="message ranking-target" data-tone="positive" role="status"><span>Você está no topo do ranking de {monthName(month, false)}.</span></p> : null}
    <section className="section-block" aria-label="Ranking do mês">
      {ranking.length ? <RankingBoard rows={ranking} meId={influencer.id} /> : <div className="state-empty"><strong>Ninguém pontuou ainda.</strong><p>A primeira venda com o cupom em {monthName(month, false)} abre o ranking.</p></div>}
    </section>
  </AppShell>;
}
