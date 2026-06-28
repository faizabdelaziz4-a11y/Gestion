/** Agrégation financière : coût main d'œuvre, diesel, charges, marge, bénéfice. */
import { db, getNumberSetting } from "./db";
import { compute, PayrollParams, Statut } from "./payroll";
import { dieselCost, shiftKm } from "./diesel";
import { shiftHours, rangeFor, daysBetween } from "./time";

interface WorkerRow {
  id: number;
  name: string;
  poste: string;
  statut: string;
  pay_type: string;
  pay_basis: string;
  base_rate: number;
}

interface ShiftRow {
  id: number;
  worker_id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  km_start: number | null;
  km_end: number | null;
}

function params(): PayrollParams {
  return {
    onssWorkerRate: getNumberSetting("onss_worker_rate", 0.1307),
    onssStudentRate: getNumberSetting("onss_student_rate", 0.0271),
    employerOnssRate: getNumberSetting("employer_onss_rate", 0.25),
  };
}

function daysInMonth(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function daysInYear(date: string): number {
  const y = Number(date.slice(0, 4));
  return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
}

/** Contexte mensuel d'un travailleur : coût employeur total et heures du mois. */
interface MonthCtx {
  monthHours: number;
  employerCost: number;
  net: number;
  brut: number;
}
const monthCache = new Map<string, MonthCtx>();

function monthContext(worker: WorkerRow, month: string): MonthCtx {
  const key = `${worker.id}:${month}`;
  const cached = monthCache.get(key);
  if (cached) return cached;

  const shifts = db
    .prepare(
      "SELECT start_time, end_time, break_minutes FROM shifts WHERE worker_id = ? AND substr(date,1,7) = ?"
    )
    .all(worker.id, month) as ShiftRow[];
  const monthHours = shifts.reduce(
    (s, sh) => s + shiftHours(sh.start_time, sh.end_time, sh.break_minutes),
    0
  );

  const statut = worker.statut as Statut;
  const basis = worker.pay_basis as "net" | "brut";
  let amount: number;
  if (worker.pay_type === "monthly") {
    amount = worker.base_rate; // salaire mensuel saisi (net ou brut)
  } else {
    amount = monthHours * worker.base_rate; // horaire × heures du mois
  }
  const bd = compute(amount, statut, basis, params());

  const ctx: MonthCtx = {
    monthHours,
    employerCost: bd.employerCost,
    net: bd.net,
    brut: bd.brut,
  };
  monthCache.set(key, ctx);
  return ctx;
}

/** Coût main d'œuvre (employeur) attribué à un jour donné. */
function laborForDay(date: string): { cost: number; details: any[] } {
  const month = date.slice(0, 7);
  const workers = db
    .prepare("SELECT * FROM workers WHERE active = 1")
    .all() as WorkerRow[];
  let cost = 0;
  const details: any[] = [];
  for (const w of workers) {
    const dayShifts = db
      .prepare(
        "SELECT start_time, end_time, break_minutes FROM shifts WHERE worker_id = ? AND date = ?"
      )
      .all(w.id, date) as ShiftRow[];
    const dayHours = dayShifts.reduce(
      (s, sh) => s + shiftHours(sh.start_time, sh.end_time, sh.break_minutes),
      0
    );
    if (dayHours === 0) continue;
    const ctx = monthContext(w, month);
    const share = ctx.monthHours > 0 ? dayHours / ctx.monthHours : 0;
    const dayCost = ctx.employerCost * share;
    cost += dayCost;
    details.push({
      workerId: w.id,
      name: w.name,
      poste: w.poste,
      hours: round(dayHours),
      cost: round(dayCost),
    });
  }
  return { cost, details };
}

function dieselForDay(date: string): { cost: number; km: number; details: any[] } {
  const shifts = db
    .prepare(
      `SELECT s.id, s.worker_id, s.km_start, s.km_end, w.name, w.poste
       FROM shifts s JOIN workers w ON w.id = s.worker_id
       WHERE s.date = ? AND s.km_start IS NOT NULL AND s.km_end IS NOT NULL`
    )
    .all(date) as Array<ShiftRow & { name: string; poste: string }>;
  let cost = 0;
  let km = 0;
  const details: any[] = [];
  for (const s of shifts) {
    const d = shiftKm(s.km_start, s.km_end);
    if (d <= 0) continue;
    const r = dieselCost(d, date);
    cost += r.cost;
    km += d;
    details.push({
      name: s.name,
      km: round(d),
      liters: round(r.liters),
      pricePerLiter: r.pricePerLiter,
      cost: round(r.cost),
    });
  }
  return { cost, km, details };
}

interface ChargeRow {
  id: number;
  label: string;
  category: string;
  kind: string;
  amount: number;
  period: string;
  date: string | null;
}

/** Part d'une charge attribuée à un jour donné. */
function chargeDailyAmount(c: ChargeRow, date: string): number {
  switch (c.period) {
    case "journalier":
      return c.amount;
    case "hebdomadaire":
      return c.amount / 7;
    case "mensuel":
      return c.amount / daysInMonth(date);
    case "annuel":
      return c.amount / daysInYear(date);
    case "ponctuel":
      return c.date === date ? c.amount : 0;
    default:
      return 0;
  }
}

function chargesForDay(date: string): {
  fixed: number;
  variable: number;
  details: any[];
} {
  const charges = db
    .prepare("SELECT * FROM charges WHERE active = 1")
    .all() as ChargeRow[];
  let fixed = 0;
  let variable = 0;
  const details: any[] = [];
  for (const c of charges) {
    const amt = chargeDailyAmount(c, date);
    if (amt === 0) continue;
    if (c.kind === "fixe") fixed += amt;
    else variable += amt;
    details.push({
      label: c.label,
      category: c.category,
      kind: c.kind,
      amount: round(amt),
    });
  }
  return { fixed, variable, details };
}

function supplementsForDay(date: string): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(amount),0) AS t FROM supplements WHERE date = ?")
    .get(date) as { t: number };
  return row.t;
}

export interface DayBreakdown {
  date: string;
  ca: number;
  marginPct: number;
  grossMargin: number; // marge commerciale = ca × marge%
  labor: number;
  diesel: number;
  fixedCharges: number;
  variableCharges: number;
  supplements: number;
  totalCosts: number;
  netProfit: number;
  details: {
    labor: any[];
    diesel: any[];
    charges: any[];
  };
}

export function dayBreakdown(date: string): DayBreakdown {
  const rev = db
    .prepare("SELECT ca, margin_pct FROM revenue WHERE date = ?")
    .get(date) as { ca: number; margin_pct: number } | undefined;
  const ca = rev?.ca ?? 0;
  const marginPct = rev?.margin_pct ?? 0;
  const grossMargin = (ca * marginPct) / 100;

  const labor = laborForDay(date);
  const diesel = dieselForDay(date);
  const charges = chargesForDay(date);
  const supplements = supplementsForDay(date);

  const totalCosts =
    labor.cost +
    diesel.cost +
    charges.fixed +
    charges.variable +
    supplements;
  const netProfit = grossMargin - totalCosts;

  return {
    date,
    ca: round(ca),
    marginPct,
    grossMargin: round(grossMargin),
    labor: round(labor.cost),
    diesel: round(diesel.cost),
    fixedCharges: round(charges.fixed),
    variableCharges: round(charges.variable),
    supplements: round(supplements),
    totalCosts: round(totalCosts),
    netProfit: round(netProfit),
    details: {
      labor: labor.details,
      diesel: diesel.details,
      charges: charges.details,
    },
  };
}

export interface PeriodSummary {
  period: "day" | "week" | "month";
  start: string;
  end: string;
  totals: Omit<DayBreakdown, "date" | "marginPct" | "details">;
  days: DayBreakdown[];
}

export function summary(
  period: "day" | "week" | "month",
  date: string
): PeriodSummary {
  monthCache.clear(); // recalcul propre
  const { start, end } = rangeFor(period, date);
  const days = daysBetween(start, end).map(dayBreakdown);
  const totals = days.reduce(
    (acc, d) => {
      acc.ca += d.ca;
      acc.grossMargin += d.grossMargin;
      acc.labor += d.labor;
      acc.diesel += d.diesel;
      acc.fixedCharges += d.fixedCharges;
      acc.variableCharges += d.variableCharges;
      acc.supplements += d.supplements;
      acc.totalCosts += d.totalCosts;
      acc.netProfit += d.netProfit;
      return acc;
    },
    {
      ca: 0,
      grossMargin: 0,
      labor: 0,
      diesel: 0,
      fixedCharges: 0,
      variableCharges: 0,
      supplements: 0,
      totalCosts: 0,
      netProfit: 0,
    }
  );
  for (const k of Object.keys(totals) as Array<keyof typeof totals>) {
    totals[k] = round(totals[k]);
  }
  return { period, start, end, totals, days };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
