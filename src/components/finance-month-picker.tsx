"use client";

import { useRouter } from "next/navigation";

export function FinanceMonthPicker({ value }: { value: string }) {
  const router = useRouter();
  return <label className="finance-month-picker"><span>Período</span><input type="month" value={value} onChange={(event) => router.push(`/admin/financeiro?month=${event.target.value}`)} /></label>;
}
