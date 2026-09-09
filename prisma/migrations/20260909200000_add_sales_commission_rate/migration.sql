-- Percentual de comissão por colaborador, guardado em pontos-base.
-- Ex.: 5,50% = 550. Mantém precisão sem valores monetários decimais.
ALTER TABLE "User" ADD COLUMN "commissionRateBps" INTEGER NOT NULL DEFAULT 0;
