export type Tone = "positive" | "danger" | "warning" | "info" | "neutral";

// Pill de status: ponto + texto. A cor reforça, mas o texto é sempre a informação.
export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className="status-pill" data-tone={tone}>{children}</span>;
}

// Tons para os rótulos de status já usados no sistema (src/lib/format.ts e telas).
const toneByLabel: Record<string, Tone> = {
  "Em dia": "positive",
  "Pago": "positive",
  "Ativo": "positive",
  "Validado": "positive",
  "Cortesia": "info",
  "Valor exclusivo": "info",
  "Em atraso": "danger",
  "Falhou": "danger",
  "Inativo": "neutral",
  "Desistente": "neutral",
  "Cancelada": "neutral",
  "Expirado": "neutral",
  "Estornado": "neutral",
  "Novo envio solicitado": "danger",
  "Aguardando pagamento": "warning",
  "Pagamento pendente": "warning",
  "Aguardando envio": "warning",
  "Aguardando validação": "warning",
  "Pendente": "warning",
};

export function toneForLabel(label: string | null | undefined): Tone {
  return (label && toneByLabel[label]) || "neutral";
}
