export type LiabilityTermStatus = "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";

export const liabilityTermStatusLabel: Record<LiabilityTermStatus, string> = {
  PENDING: "Aguardando envio",
  SUBMITTED: "Aguardando validação",
  APPROVED: "Validado",
  REJECTED: "Novo envio solicitado",
};
