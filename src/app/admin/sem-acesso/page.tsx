import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth";

export default async function AccessDeniedPage() {
  const user = await requireStaff();
  return <AppShell user={user} current="admin"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Acesso restrito</p><h1>Esta área não está liberada para sua conta.</h1><p>Peça a um administrador para revisar as permissões do seu cargo.</p></div></div></section></AppShell>;
}
