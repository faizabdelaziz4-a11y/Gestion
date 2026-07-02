"use client";

import { useState } from "react";
import { eur } from "./api";

interface Day {
  date: string;
  netProfit: number;
  ca: number;
}

/** Histogramme bénéfice net par jour : ligne de zéro, vert au-dessus / rouge en dessous. */
export function ProfitChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!days.length) return <Empty />;

  const values = days.map((d) => d.netProfit);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;

  const W = 900;
  const H = 240;
  const padY = 16;
  const plotH = H - padY * 2;
  const zeroY = padY + (max / span) * plotH; // y de la ligne zéro
  const n = days.length;
  const gap = n > 40 ? 1 : 3;
  const bw = W / n;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="220" preserveAspectRatio="none">
        {/* grille horizontale discrète */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={0}
            x2={W}
            y1={padY + t * plotH}
            y2={padY + t * plotH}
            stroke="var(--hairline)"
            strokeWidth={1}
          />
        ))}
        {/* ligne de zéro */}
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#c3c2b7" strokeWidth={1.5} />
        {days.map((d, i) => {
          const x = i * bw + gap / 2;
          const w = bw - gap;
          const h = (Math.abs(d.netProfit) / span) * plotH;
          const y = d.netProfit >= 0 ? zeroY - h : zeroY;
          const pos = d.netProfit >= 0;
          const active = hover === i;
          return (
            <rect
              key={d.date}
              x={x}
              y={Math.min(y, zeroY - 0.5)}
              width={Math.max(1, w)}
              height={Math.max(1.5, h)}
              rx={Math.min(3, w / 2)}
              fill={pos ? "var(--good)" : "var(--bad)"}
              opacity={hover === null || active ? 1 : 0.55}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${((hover + 0.5) / n) * 100}%`,
            background: "var(--ink)",
            color: "#fff",
          }}
        >
          <div className="font-medium">{days[hover].date}</div>
          <div className="tnum">
            Bénéfice :{" "}
            <span style={{ color: days[hover].netProfit >= 0 ? "#5ee0a0" : "#ff9a9a" }}>
              {eur(days[hover].netProfit)}
            </span>
          </div>
          <div className="tnum text-slate-300">CA : {eur(days[hover].ca)}</div>
        </div>
      )}
    </div>
  );
}

interface CostSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Barre empilée horizontale : structure des coûts + légende chiffrée. */
export function CostBar({
  labor,
  diesel,
  fixedCharges,
  variableCharges,
  platformFee,
  supplements,
}: {
  labor: number;
  diesel: number;
  fixedCharges: number;
  variableCharges: number;
  platformFee: number;
  supplements: number;
}) {
  const slices: CostSlice[] = [
    { key: "labor", label: "Main d'œuvre", value: labor, color: "var(--c-labor)" },
    { key: "diesel", label: "Diesel", value: diesel, color: "var(--c-diesel)" },
    { key: "fixed", label: "Charges fixes", value: fixedCharges, color: "var(--c-fixed)" },
    { key: "variable", label: "Charges variables", value: variableCharges, color: "var(--c-variable)" },
    { key: "platform", label: "Commission plateforme", value: platformFee, color: "var(--c-platform)" },
    { key: "supp", label: "Suppléments", value: supplements, color: "var(--c-supp)" },
  ].filter((s) => s.value > 0);

  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <Empty label="Aucun coût sur la période." />;

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full" style={{ gap: 2 }}>
        {slices.map((s) => (
          <div
            key={s.key}
            title={`${s.label} : ${eur(s.value)}`}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="tnum shrink-0 font-medium">{eur(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ label = "Pas encore de données." }: { label?: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-slate-400">
      {label}
    </div>
  );
}
