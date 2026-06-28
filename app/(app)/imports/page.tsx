"use client";

import { useState } from "react";
import { api, eur, getActiveBusinessId } from "../../components/api";
import { useBusiness } from "../../components/BusinessContext";

type Field = "date" | "ca" | "margin_pct" | "cash_closing" | "cash_opening";
const FIELD_LABELS: Record<Field, string> = {
  date: "Date *",
  ca: "Chiffre d'affaires",
  margin_pct: "Marge (%)",
  cash_closing: "Caisse fin (cash)",
  cash_opening: "Fond de caisse (début)",
};

export default function ImportsPage() {
  const { active } = useBusiness();
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<Field, string | null>>({
    date: null,
    ca: null,
    margin_pct: null,
    cash_closing: null,
    cash_opening: null,
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");

  async function onFile(file: File) {
    setErr("");
    setResult(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const biz = getActiveBusinessId();
      const res = await fetch("/api/import", {
        method: "POST",
        headers: biz ? { "x-business-id": biz } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import impossible");
      setColumns(data.columns);
      setRows(data.rows);
      setMapping(data.mapping);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setErr("");
    try {
      const r = await api("/api/import/commit", {
        method: "POST",
        body: JSON.stringify({ mapping, rows }),
      });
      setResult(r);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const setMap = (f: Field, col: string) =>
    setMapping((m) => ({ ...m, [f]: col || null }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Imports & intégrations</h1>
      <p className="text-sm text-slate-500">
        Importez un export de votre caisse / POS / comptable (CSV ou JSON) vers
        <strong> {active?.name}</strong>. Les données alimentent directement le tableau de bord.
      </p>

      <div className="card">
        <label className="btn-primary cursor-pointer inline-block">
          📥 Choisir un fichier (CSV / JSON)
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
        {busy && <span className="ml-3 text-sm text-slate-400">Traitement…</span>}
        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      </div>

      {columns.length > 0 && (
        <>
          <div className="card">
            <h2 className="font-semibold mb-3">Correspondance des colonnes</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                <div key={f}>
                  <label className="label">{FIELD_LABELS[f]}</label>
                  <select
                    className="input"
                    value={mapping[f] || ""}
                    onChange={(e) => setMap(f, e.target.value)}
                  >
                    <option value="">— ignorer —</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button className="btn-primary" onClick={commit} disabled={busy || !mapping.date}>
                Importer {rows.length} ligne(s)
              </button>
              {!mapping.date && (
                <span className="text-xs text-red-500">Mappez au moins la Date.</span>
              )}
            </div>
          </div>

          <div className="card overflow-x-auto">
            <h2 className="font-semibold mb-3">Aperçu</h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 border-b">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="cell">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 15).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {columns.map((c) => (
                      <td key={c} className="cell">
                        {r[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 15 && (
              <p className="text-xs text-slate-400 mt-2">… et {rows.length - 15} autres lignes.</p>
            )}
          </div>
        </>
      )}

      {result && (
        <div className="card bg-emerald-50 border-emerald-200">
          <h2 className="font-semibold text-emerald-700">Import terminé ✓</h2>
          <p className="text-sm mt-1">
            {result.revCount} jour(s) de CA et {result.cashCount} caisse(s) importés sur{" "}
            {result.total} ligne(s).
          </p>
          {result.errors?.length > 0 && (
            <details className="text-xs mt-2 text-red-600">
              <summary>{result.errors.length} ligne(s) ignorée(s)</summary>
              <ul className="mt-1">
                {result.errors.map((e: string, i: number) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
