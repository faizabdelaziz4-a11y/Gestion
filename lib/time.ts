/** Utilitaires de temps et de dates (semaine ISO, agrégations). */

/** Heures travaillées d'un shift, pauses déduites. */
export function shiftHours(
  start?: string | null,
  end?: string | null,
  breakMinutes = 0
): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // shift de nuit
  mins -= Math.max(0, breakMinutes);
  return Math.max(0, mins) / 60;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Lundi (ISO) de la semaine contenant `date` (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // 0 = lundi
  d.setUTCDate(d.getUTCDate() - day);
  return isoDate(d);
}

export function weekEnd(date: string): string {
  const d = new Date(weekStart(date) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return isoDate(d);
}

export function monthRange(month: string): { start: string; end: string } {
  // month = YYYY-MM
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = isoDate(new Date(Date.UTC(y, m, 0)));
  return { start, end };
}

export function rangeFor(
  period: "day" | "week" | "month",
  date: string
): { start: string; end: string } {
  if (period === "day") return { start: date, end: date };
  if (period === "week") return { start: weekStart(date), end: weekEnd(date) };
  return monthRange(date.slice(0, 7));
}

export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  while (d <= last) {
    out.push(isoDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
