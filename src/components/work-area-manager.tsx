"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

  return <><button className="work-area-create-trigger" type="button" onClick={() => setOpen(true)} aria-label="Criar nova área de trabalho" title="Criar nova área">+</button>{open ? <div className="work-area-editor-layer" role="dialog" aria-modal="true" aria-label="Criar área de trabalho"><button className="work-area-editor-backdrop" type="button" aria-label="Fechar" onClick={close} /><section className="work-area-editor"><div className="panel-heading"><div><p className="eyebrow">Nova área</p><h2>Organize o trabalho.</h2><p>Crie uma área geral ou uma área de um setor da equipe.</p></div><button className="button button-quiet" type="button" onClick={close}>Fechar</button></div><div className="field"><label htmlFor="work-area-name">Nome da área</label><input id="work-area-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Treinadores" autoFocus /></div><div className="field"><label htmlFor="work-area-type">Tipo</label><select id="work-area-type" value={type} onChange={(event) => setType(event.target.value as "GENERAL" | "SECTOR")}><option value="GENERAL">Área geral</option><option value="SECTOR">Setor da equipe</option></select></div>{error ? <p className="error-message">{error}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={create} disabled={saving}>{saving ? "Criando..." : "Criar área"}</button></div></section></div> : null}</>;
}
