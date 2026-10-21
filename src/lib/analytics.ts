import { DAYS, TT } from "../data/timetable";
import { addDays, asDayName, toISODate } from "./date";
import { logKey, sessionsOn } from "./attendance";
import type { DaySeriesPoint, HeatCell, SlotKey, Status } from "../types";

/** Per-day present/absent counts for the trailing `days` calendar days. */
export function dailySeries(log: Record<string, Status>, days = 14, today = new Date()): DaySeriesPoint[] {
  const out: DaySeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const iso = toISODate(date);
    let present = 0;
    let absent = 0;
    for (const session of sessionsOn(iso)) {
      const status = log[logKey(iso, session.slot)];
      if (status === "P") present++;
      else if (status === "A") absent++;
    }
    const held = present + absent;
    out.push({ date: iso, present, absent, rate: held ? Math.round((present * 100) / held) : null });
  }
  return out;
}

/** Rolling attendance rate over the trailing window (null when nothing held). */
export function rollingRate(log: Record<string, Status>, days: number, today = new Date()): number | null {
  let present = 0;
  let held = 0;
  for (let i = 0; i < days; i++) {
    const iso = toISODate(addDays(today, -i));
    for (const session of sessionsOn(iso)) {
      const status = log[logKey(iso, session.slot)];
      if (status === "P") { present++; held++; }
      else if (status === "A") held++;
    }
  }
  return held ? Math.round((present * 1000) / held) / 10 : null;
}

/** Consecutive attended classes ending at the most recent marked class. */
export function presentStreak(log: Record<string, Status>): number {
  const keys = Object.keys(log).sort();
  if (!keys.length) return 0;
  const ordered = keys
    .map((key) => {
      const [iso, slot] = key.split("|");
      return { iso, slot: slot as SlotKey, status: log[key] };
    })
    .filter((e) => e.status !== "C")
    .sort((a, b) => (a.iso === b.iso ? a.slot.localeCompare(b.slot) : a.iso.localeCompare(b.iso)));

  let streak = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].status === "P") streak++;
    else break;
  }
  return streak;
}

/** Number of distinct days on which attendance was marked. */
export function daysMarked(log: Record<string, Status>): number {
  return new Set(Object.keys(log).map((k) => k.split("|")[0])).size;
}

/** Calendar heatmap for the trailing `weeks` weeks (Monday-first columns). */
export function heatmap(log: Record<string, Status>, weeks = 14, today = new Date()): HeatCell[] {
  const cells: HeatCell[] = [];
  const start = addDays(today, -((weeks - 1) * 7 + ((today.getDay() + 6) % 7)));
  const total = weeks * 7;
  for (let i = 0; i < total; i++) {
    const date = addDays(start, i);
    const iso = toISODate(date);
    const isFuture = date > today;
    const day = asDayName(date);
    if (!day || isFuture) {
      cells.push({ date: iso, level: null, title: `${iso} — no classes` });
      continue;
    }
    let present = 0;
    let absent = 0;
    for (const session of sessionsOn(iso)) {
      const status = log[logKey(iso, session.slot)];
      if (status === "P") present++;
      else if (status === "A") absent++;
    }
    const held = present + absent;
    if (!held) {
      cells.push({ date: iso, level: 0, title: `${iso} — nothing marked` });
      continue;
    }
    const rate = present / held;
    const level = rate >= 1 ? 4 : rate >= 0.75 ? 3 : rate >= 0.5 ? 2 : 1;
    cells.push({ date: iso, level: level as HeatCell["level"], title: `${iso} — ${present}/${held} attended` });
  }
  return cells;
}

/** Attendance rate for one subject over the trailing window. */
export function subjectRate(
  log: Record<string, Status>,
  code: string,
  days: number,
  today = new Date(),
): number | null {
  let present = 0;
  let held = 0;
  for (let i = 0; i < days; i++) {
    const iso = toISODate(addDays(today, -i));
    for (const session of sessionsOn(iso)) {
      if (session.code !== code) continue;
      const status = log[logKey(iso, session.slot)];
      if (status === "P") { present++; held++; }
      else if (status === "A") held++;
    }
  }
  return held ? Math.round((present * 1000) / held) / 10 : null;
}

/** Weekly session load derived from the timetable (classes per weekday). */
export function weeklyLoad(): { day: string; count: number }[] {
  return DAYS.map((day) => ({ day, count: Object.keys(TT[day]).length }));
}

/** Projected attendance if the next `n` classes are all attended. */
export function projectAfterAttending(present: number, held: number, n: number): number | null {
  const h = held + n;
  return h ? Math.round(((present + n) * 1000) / h) / 10 : null;
}

/** Classes that must be attended consecutively to hit `target`. */
export function classesNeededToTarget(present: number, held: number, target: number): number {
  const t = target / 100;
  if (!held || present / held >= t) return 0;
  return Math.ceil((t * held - present) / (1 - t));
}

