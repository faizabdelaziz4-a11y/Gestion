/** Agrégation financière par commerce : main d'œuvre, diesel, charges, marge, bénéfice. */
import { db, getBusiness, Business } from "./db";
import { compute, PayrollParams, Statut } from "./payroll";
import { dieselCost, shiftKm, DieselConfig } from "./diesel";
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
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  km_start: number | null;
  km_end: number | null;
}

function payrollParams(b: Business): PayrollParams {
  return {
    onssWorkerRate: b.onss_worker_rate,
    onssStudentRate: b.onss_student_rate,
    employerOnssRate: b.employer_onss_rate,
  };
}
function dieselConfig(b: Business): DieselConfig {
  return { consumption: b.diesel_consumption, defaultPrice: b.default_diesel_price };
}

function daysInMonth(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function daysInYear(date: string): number {
  const y = Number(date.slice(0, 4));
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365;
}

interface MonthCtx {
  monthHours: number;
  employerCost: number;
  net: number;
  brut: number;
}

/** Calculateur lié à un commerce (cache mensuel propre par instance). */
class FinanceCalc {
  private monthCache = new Map<string, MonthCtx>();
  constructor(private b: Business) {}

  private monthContext(worker: WorkerRow, month: string): MonthCtx {
    const key = `${worker.id}:${month}`;
    const cached = this.monthCache.get(key);
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
    const amount =
      worker.pay_type === "monthly" ? worker.base_rate : monthHours * worker.base_rate;
    const bd = compute(
      amount,
      worker.statut as Statut,
      worker.pay_basis as "net" | "brut",
      payrollParams(this.b)
    );
    const ctx: MonthCtx = {
      monthHours,
      employerCost: bd.employerCost,
      net: bd.net,
      brut: bd.brut,
    };
    this.monthCache.set(key, ctx);
    return ctx;
  }

  private laborForDay(date: string) {
    const month = date.slice(0, 7);
    const workers = db
      .prepare("SELECT * FROM workers WHERE active = 1 AND business_id = ?")
      .all(this.b.id) as WorkerRow[];
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
      const ctx = this.monthContext(w, month);
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

  private dieselForDay(date: string) {
    const shifts = db
      .prepare(
        `SELECT s.km_start, s.km_end, w.name FROM shifts s JOIN workers w ON w.id = s.worker_id
         WHERE s.date = ? AND w.business_id = ? AND s.km_start IS NOT NULL AND s.km_end IS NOT NULL`
      )
      .all(date, this.b.id) as Array<ShiftRow & { name: string }>;
    let cost = 0;
    let km = 0;
    const details: any[] = [];
    for (const s of shifts) {
      const d = shiftKm(s.km_start, s.km_end);
      if (d <= 0) continue;
      const r = dieselCost(d, date, dieselConfig(this.b));
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

  private chargesForDay(date: string) {
    const charges = db
      .prepare("SELECT * FROM charges WHERE active = 1 AND business_id = ?")
      .all(this.b.id) as Array<{
      label: string;
      category: string;
      kind: string;
      amount: number;
      period: string;
      date: string | null;
    }>;
    let fixed = 0;
    let variable = 0;
    const details: any[] = [];
    for (const c of charges) {
      const amt = chargeDailyAmount(c, date);
      if (amt === 0) continue;
      if (c.kind === "fixe") fixed += amt;
      else variable += amt;
      details.push({ label: c.label, category: c.category, kind: c.kind, amount: round(amt) });
    }
    return { fixed, variable, details };
  }

  private supplementsForDay(date: string): number {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(s.amount),0) AS t FROM supplements s
         JOIN workers w ON w.id = s.worker_id WHERE s.date = ? AND w.business_id = ?`
      )
      .get(date, this.b.id) as { t: number };
    return row.t;
  }

  dayBreakdown(date: string): DayBreakdown {
    // Un jour futur n'a pas encore de coûts : on ne projette pas de perte.
    if (date > todayStr()) return zeroDay(date);
    const rev = db
      .prepare(
        "SELECT ca, margin_pct, platform_ca, platform_rate, source FROM revenue WHERE date = ? AND business_id = ?"
      )
      .get(date, this.b.id) as
      | {
          ca: number;
          margin_pct: number;
          platform_ca: number;
          platform_rate: number;
          source: string;
        }
      | undefined;
    const ca = rev?.ca ?? 0;
    const marginPct = rev?.margin_pct ?? 0;
    const grossMargin = (ca * marginPct) / 100;
    const platformFee = (rev?.platform_ca ?? 0) * (rev?.platform_rate ?? 0.17);

    const labor = this.laborForDay(date);
    const diesel = this.dieselForDay(date);
    const charges = this.chargesForDay(date);
    const supplements = this.supplementsForDay(date);
    const totalCosts =
      labor.cost + diesel.cost + charges.fixed + charges.variable + supplements + platformFee;

    return {
      date,
      ca: round(ca),
      marginPct,
      source: rev?.source ?? null,
      grossMargin: round(grossMargin),
      labor: round(labor.cost),
      diesel: round(diesel.cost),
      fixedCharges: round(charges.fixed),
      variableCharges: round(charges.variable),
      supplements: round(supplements),
      platformFee: round(platformFee),
      totalCosts: round(totalCosts),
      netProfit: round(grossMargin - totalCosts),
      details: { labor: labor.details, diesel: diesel.details, charges: charges.details },
    };
  }
}

function chargeDailyAmount(
  c: { amount: number; period: string; date: string | null },
  date: string
): number {
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

export interface DayBreakdown {
  date: string;
  ca: number;
  marginPct: number;
  source: string | null;
  grossMargin: number;
  labor: number;
  diesel: number;
  fixedCharges: number;
  variableCharges: number;
  supplements: number;
  platformFee: number;
  totalCosts: number;
  netProfit: number;
  details: { labor: any[]; diesel: any[]; charges: any[] };
}

export interface PeriodSummary {
  period: "day" | "week" | "month";
  businessId: number;
  start: string;
  end: string;
  totals: Omit<DayBreakdown, "date" | "marginPct" | "details" | "source">;
  days: DayBreakdown[];
}

export function summary(
  businessId: number,
  period: "day" | "week" | "month",
  date: string
): PeriodSummary {
  const b = getBusiness(businessId);
  if (!b) {
    return {
      period,
      businessId,
      start: date,
      end: date,
      totals: emptyTotals(),
      days: [],
    };
  }
  const calc = new FinanceCalc(b);
  const { start, end } = rangeFor(period, date);
  const days = daysBetween(start, end).map((d) => calc.dayBreakdown(d));
  const totals = days.reduce((acc, d) => {
    acc.ca += d.ca;
    acc.grossMargin += d.grossMargin;
    acc.labor += d.labor;
    acc.diesel += d.diesel;
    acc.fixedCharges += d.fixedCharges;
    acc.variableCharges += d.variableCharges;
    acc.supplements += d.supplements;
    acc.platformFee += d.platformFee;
    acc.totalCosts += d.totalCosts;
    acc.netProfit += d.netProfit;
    return acc;
  }, emptyTotals());
  for (const k of Object.keys(totals) as Array<keyof typeof totals>) {
    totals[k] = round(totals[k]);
  }
  return { period, businessId, start, end, totals, days };
}

function emptyTotals() {
  return {
    ca: 0,
    grossMargin: 0,
    labor: 0,
    diesel: 0,
    fixedCharges: 0,
    variableCharges: 0,
    supplements: 0,
    platformFee: 0,
    totalCosts: 0,
    netProfit: 0,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function zeroDay(date: string): DayBreakdown {
  return {
    date,
    ca: 0,
    marginPct: 0,
    source: null,
    grossMargin: 0,
    labor: 0,
    diesel: 0,
    fixedCharges: 0,
    variableCharges: 0,
    supplements: 0,
    platformFee: 0,
    totalCosts: 0,
    netProfit: 0,
    details: { labor: [], diesel: [], charges: [] },
  };
}
