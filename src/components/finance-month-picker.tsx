"use client";

import { useRouter } from "next/navigation";

export function FinanceMonthPicker({ value }: { value: string }) {
  const router = useRouter();
  return <div className="form-field finance-period">
    <label htmlFor="finance-period">Período</label>
    <input className="control" id="finance-period" type="month" value={value} onChange={(event) => event.target.value && router.push(`/admin/financeiro?month=${event.target.value}`)} />
  </div>;
}
