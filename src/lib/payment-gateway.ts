import { getAppmaxCheckoutConfig } from "@/lib/appmax";
import { getStoredAsaasIntegration } from "@/lib/asaas-integration";
import { getActivePaymentProvider } from "@/lib/integration-directory";

export type PaymentGatewayKey = "APPMAX" | "ASAAS";

export type PaymentCheckoutConfig = {
  enabled: boolean;
  activeProvider: PaymentGatewayKey | null;
  appmaxExternalId: string | null;
  recurrenceEnabled: boolean;
};

export async function getPaymentCheckoutConfig(): Promise<PaymentCheckoutConfig> {
  const activeProvider = await getActivePaymentProvider();
  if (activeProvider === "APPMAX") {
    const appmax = await getAppmaxCheckoutConfig();
    return {
      enabled: appmax.enabled,
      activeProvider: "APPMAX",
      appmaxExternalId: appmax.externalId,
      recurrenceEnabled: appmax.recurrenceEnabled,
    };
  }

  if (activeProvider === "ASAAS") {
    const asaas = await getStoredAsaasIntegration();
    return {
      enabled: Boolean(asaas?.isActive),
      activeProvider: "ASAAS",
      appmaxExternalId: null,
      recurrenceEnabled: false,
    };
  }

  return {
    enabled: false,
    activeProvider: null,
    appmaxExternalId: null,
    recurrenceEnabled: false,
  };
}
