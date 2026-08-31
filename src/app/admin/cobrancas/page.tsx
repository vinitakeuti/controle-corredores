import { redirect } from "next/navigation";

export default async function BillingSettingsPage() {
  redirect("/admin/planos");
}
