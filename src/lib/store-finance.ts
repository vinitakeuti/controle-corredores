export type StoreSalesSummary = { count: number; totalCents: number };

export async function getStoreSalesSummary(month: string): Promise<StoreSalesSummary> {
  const urlValue = process.env.STORE_FINANCE_SUMMARY_URL;
  const sharedSecret = process.env.STORE_AUTH_SHARED_SECRET;
  if (!urlValue || !sharedSecret) return { count: 0, totalCents: 0 };

  try {
    const url = new URL(urlValue);
    url.searchParams.set("month", month);
    const response = await fetch(url, { cache: "no-store", headers: { "x-store-auth-secret": sharedSecret }, signal: AbortSignal.timeout(5_000) });
    const payload: unknown = response.ok ? await response.json() : null;
    if (!payload || typeof payload !== "object") return { count: 0, totalCents: 0 };
    const { count, totalCents } = payload as { count?: unknown; totalCents?: unknown };
    if (typeof count !== "number" || typeof totalCents !== "number" || !Number.isInteger(count) || !Number.isInteger(totalCents) || count < 0 || totalCents < 0) return { count: 0, totalCents: 0 };
    return { count, totalCents };
  } catch {
    return { count: 0, totalCents: 0 };
  }
}
