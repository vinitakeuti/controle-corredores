import { prisma } from "@/lib/prisma";

export type IntegrationProviderKey = "APPMAX" | "OTHER";

export type IntegrationDirectoryItem = {
  provider: IntegrationProviderKey;
  name: string;
  abbreviation: string;
  category: string;
  description: string;
  detail: string;
  available: boolean;
  configured: boolean;
  active: boolean;
};

export type IntegrationDirectory = {
  activeProvider: string | null;
  items: IntegrationDirectoryItem[];
};

export async function getActivePaymentProvider() {
  const active = await prisma.paymentIntegration.findFirst({
    where: { isActive: true },
    select: { provider: true },
  });
  return active?.provider ?? null;
}

export async function getIntegrationDirectory(): Promise<IntegrationDirectory> {
  const records = await prisma.paymentIntegration.findMany({
    select: { provider: true, isActive: true },
  });
  const appmax = records.find((record) => record.provider === "APPMAX");
  const activeProvider = records.find((record) => record.isActive)?.provider ?? null;

  return {
    activeProvider,
    items: [
      {
        provider: "APPMAX",
        name: "Appmax",
        abbreviation: "AM",
        category: "Gateways & vendas",
        description: "Pix, boleto e cartão em um único checkout.",
        detail: "Processa pagamentos e confirmações da assinatura diretamente no fluxo da assessoria.",
        available: true,
        configured: Boolean(appmax),
        active: appmax?.isActive ?? false,
      },
      {
        provider: "OTHER",
        name: "Outro provedor",
        abbreviation: "+",
        category: "Gateways & vendas",
        description: "Prepare a próxima conexão de pagamentos.",
        detail: "Este espaço está reservado para o próximo gateway ou instituição financeira da assessoria.",
        available: false,
        configured: false,
        active: false,
      },
    ],
  };
}
