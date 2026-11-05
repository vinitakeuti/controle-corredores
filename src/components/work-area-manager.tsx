"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";

export function WorkAreaManager() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"GENERAL" | "SECTOR">("SECTOR");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function close() {
    if (!saving) {
      setOpen(false);
      setError("");
    }
  }

  async function create() {
    if (!name.trim()) {
      setError("Informe o nome da área.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/demandas/areas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, type }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível criar a área.");
        return;
      }
      router.push(`/admin/demandas/${data.area.id}`);
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}><Icon name="plus" />Nova área</button>
    {open ? <Sheet open onClose={close} title="Organize o trabalho.">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void create(); }}>
        <p className="section-lead sheet-lead">Crie uma área geral ou uma área de um setor da equipe.</p>
        <div className="form-field"><label htmlFor="work-area-name">Nome da área</label><input className="control" id="work-area-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Treinadores" data-autofocus /></div>
        <div className="form-field"><label htmlFor="work-area-type">Tipo</label><select className="control" id="work-area-type" value={type} onChange={(event) => setType(event.target.value as "GENERAL" | "SECTOR")}><option value="GENERAL">Área geral</option><option value="SECTOR">Setor da equipe</option></select></div>
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions"><button className="btn btn-quiet" type="button" onClick={close}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving} aria-busy={saving}>{saving ? "Criando..." : "Criar área"}</button></div>
      </form>
    </Sheet> : null}
  </>;
}
