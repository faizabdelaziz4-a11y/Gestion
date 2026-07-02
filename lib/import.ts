/**
 * Import de fichiers (CSV / JSON) exportés d'un POS / caisse / comptable.
 * Parse le fichier, devine le mappage des colonnes (date, CA, marge, cash),
 * renvoie un aperçu. L'écriture en base se fait après validation côté client.
 */

export interface ParsedFile {
  columns: string[];
  rows: Record<string, string>[];
}

/** Détecte le séparateur CSV (`,` ou `;` ou tab). */
function detectDelimiter(line: string): string {
  const counts: Record<string, number> = {
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    "\t": (line.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Parseur CSV simple gérant les guillemets. */
function parseCsv(text: string): ParsedFile {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return { columns: [], rows: [] };
  const delim = detectDelimiter(lines[0]);

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === delim && !inQ) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const columns = splitLine(lines[0]);
  const rows = lines.slice(1).map((l) => {
    const cells = splitLine(l);
    const obj: Record<string, string> = {};
    columns.forEach((c, i) => (obj[c] = cells[i] ?? ""));
    return obj;
  });
  return { columns, rows };
}

function parseJson(text: string): ParsedFile {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.rows || data.data || [];
  const columns = arr.length ? Object.keys(arr[0]) : [];
  const rows = arr.map((r: any) => {
    const obj: Record<string, string> = {};
    for (const k of columns) obj[k] = r[k] == null ? "" : String(r[k]);
    return obj;
  });
  return { columns, rows };
}

export function parseFile(filename: string, text: string): ParsedFile {
  if (filename.toLowerCase().endsWith(".json")) return parseJson(text);
  return parseCsv(text);
}

export type Field =
  | "date"
  | "ca"
  | "margin_pct"
  | "platform_ca"
  | "cash_closing"
  | "cash_opening";

/** Devine quelle colonne correspond à quel champ, d'après son intitulé. */
export function guessMapping(columns: string[]): Record<Field, string | null> {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  const find = (kws: string[]) =>
    columns.find((c) => kws.some((k) => norm(c).includes(k))) ?? null;
  return {
    date: find(["date", "jour", "day"]),
    ca: find(["ca", "chiffre", "vente", "total", "revenue", "turnover", "montant"]),
    margin_pct: find(["marge", "margin"]),
    platform_ca: find(["plateforme", "platform", "uber", "deliveroo", "takeaway", "livraison"]),
    cash_closing: find(["cash", "especes", "espece", "caisse", "liquide"]),
    cash_opening: find(["fond", "ouverture", "opening"]),
  };
}

/** Convertit une valeur ("1 234,56 €") en nombre. */
export function toNumber(v: string): number {
  if (!v) return 0;
  const cleaned = v
    .replace(/[^0-9,.\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // milliers '.'
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Normalise une date (JJ/MM/AAAA, AAAA-MM-JJ…) en ISO. */
export function toIsoDate(v: string): string | null {
  v = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/.exec(v);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}
