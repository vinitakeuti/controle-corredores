import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { homeHrefFor } from "@/components/shell/nav";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";

export default async function AccessDeniedPage() {
  const user = await requireStaff();
  return <AppShell user={user} current="admin">
    <div className="blocked">
      <PageHeader context={{ label: "Acesso restrito" }} title="Esta área não está liberada para sua conta." lead="Peça a um administrador para revisar as permissões do seu cargo." />
      <div className="btn-row"><Link className="btn btn-secondary" href={homeHrefFor(user.role)}><Icon name="arrowLeft" />Voltar para o início</Link></div>
    </div>
  </AppShell>;
}
