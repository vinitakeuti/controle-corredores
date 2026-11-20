import { influencerTypeLabel } from "@/lib/influencers";

type Row = { influencerId: string; type: "EXPERT" | "CREATOR"; name: string; initials: string; points: number; position: number };

const pointsLabel = (points: number) => (points === 1 ? "ponto" : "pontos");

// Pódio de prova para os três primeiros. A ordem no HTML é 1º, 2º, 3º (é a que o
// leitor de tela lê); o CSS posiciona o 2º à esquerda e o 3º à direita.
function Podium({ rows, meId }: { rows: Row[]; meId: string }) {
  return <ol className="podium" aria-label="Pódio do mês">
    {[0, 1, 2].map((slot) => {
      const row = rows[slot];
      const place = slot + 1;
      const isMe = row?.influencerId === meId;
      return <li className="podium-step" data-place={place} data-me={isMe || undefined} data-empty={row ? undefined : true} key={place}>
        <div className="podium-athlete">
          {row ? <>
            <span className="avatar podium-avatar" aria-hidden="true">{row.initials}</span>
            <strong className="podium-name">{row.name}</strong>
            {isMe ? <span className="podium-you">Você</span> : <span className="podium-type">{influencerTypeLabel[row.type]}</span>}
            <span className="podium-points"><b>{row.points}</b> {row.points === 1 ? "pt" : "pts"}</span>
            <span className="visually-hidden">{`${row.position}º lugar${isMe ? ", você" : ""}, ${row.points} ${pointsLabel(row.points)}.`}</span>
          </> : <span className="podium-open">Vaga aberta<span className="visually-hidden"> no {place}º lugar.</span></span>}
        </div>
        <div className="podium-block" aria-hidden="true"><span className="podium-number">{row?.position ?? place}</span></div>
      </li>;
    })}
  </ol>;
}

function RankingRow({ row, meId }: { row: Row; meId: string }) {
  const isMe = row.influencerId === meId;
  return <li className="ranking-item" data-me={isMe || undefined}>
    <span className="ranking-pos">{row.position}<span className="visually-hidden">º lugar</span></span>
    <span className="avatar ranking-avatar" aria-hidden="true">{row.initials}</span>
    <span className="ranking-who"><strong>{row.name}</strong>{isMe ? <span className="ranking-me">Você</span> : <span className="ranking-type">{influencerTypeLabel[row.type]}</span>}</span>
    <span className="ranking-points"><b>{row.points}</b> {row.points === 1 ? "pt" : "pts"}</span>
  </li>;
}

// Ranking do mês: pódio para os três primeiros e lista do 4º em diante.
// Compacto (Minha área): pódio + quem está perto de você.
export function RankingBoard({ rows, meId, compact = false }: { rows: Row[]; meId: string; compact?: boolean }) {
  const meIndex = rows.findIndex((row) => row.influencerId === meId);
  const rest = rows.map((row, index) => ({ row, index })).slice(3);
  const listed = !compact ? rest : meIndex >= 3 ? rest.filter(({ index }) => Math.abs(index - meIndex) <= 2) : rest.slice(0, 2);
  const skipped = listed.length > 0 && listed[0].index > 3;
  return <div className="ranking-board">
    <Podium rows={rows} meId={meId} />
    {listed.length ? <ol className="ranking-list" aria-label={compact ? "Quem está perto de você" : "Do 4º lugar em diante"}>
      {skipped ? <li className="ranking-gap" aria-hidden="true">···</li> : null}
      {listed.map(({ row }) => <RankingRow key={row.influencerId} row={row} meId={meId} />)}
    </ol> : null}
  </div>;
}
