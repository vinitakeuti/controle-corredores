"use client";

import { usePathname, useRouter } from "next/navigation";

// Mês de referência do programa (vendas e comissões são organizadas por mês).
export function MarketingMonthPicker({ value, max }: { value: string; max: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return <div className="form-field marketing-period">
    <label htmlFor="marketing-period">Mês</label>
    <input className="control" id="marketing-period" type="month" value={value} max={max} onChange={(event) => event.target.value && router.push(`${pathname}?month=${event.target.value}`)} />
  </div>;
}
