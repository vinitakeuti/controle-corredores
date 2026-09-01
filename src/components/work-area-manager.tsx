"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkAreaManager() {
  const router = useRouter(); const [name, setName] = useState(""); const [type, setType] = useState<"GENERAL" | "SECTOR">("SECTOR"); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function create() { if (!name.trim()) { setError("Informe o nome da área."); return; } setSaving(true); setError(""); try { const response = await fetch("/api/demandas/areas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, type }) }); const data = await response.json(); if (!response.ok) { setError(data.error ?? "Não foi possível criar a área."); return; } router.push(`/admin/demandas/${data.area.id}`); router.refresh(); } catch { setError("Não foi possível conectar ao servidor."); } finally { setSaving(false); } }
  return <section className="work-area-create"><div className="field"><label htmlFor="work-area-name">Nome da área</label><input id="work-area-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Treinadores" /></div><div className="field"><label htmlFor="work-area-type">Tipo</label><select id="work-area-type" value={type} onChange={(event) => setType(event.target.value as "GENERAL" | "SECTOR")}><option value="GENERAL">Área geral</option><option value="SECTOR">Setor da equipe</option></select></div>{error ? <p className="error-message">{error}</p> : null}<button className="button button-dark" type="button" onClick={create} disabled={saving}>{saving ? "Criando..." : "Criar área"}</button></section>;
}
