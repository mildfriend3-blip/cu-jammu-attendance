import { SUBJECTS, TT } from "../data/timetable";
import { asDayName } from "./date";
import type { Advice, SessionEntry, SlotKey, Status, SubjectTally, Totals } from "../types";

export const logKey = (isoDate: string, slot: SlotKey) => `${isoDate}|${slot}`;

export function sessionsOn(isoDate: string): SessionEntry[] {
  const day = asDayName(new Date(`${isoDate}T00:00:00`));
  if (!day) return [];
  const row = TT[day];
  return (Object.keys(row) as SlotKey[])
    .map((slot) => ({ slot, code: row[slot] as string }))
    .sort((a, b) => a.slot.localeCompare(b.slot));
}

export function computeTotals(log: Record<string, Status>): Totals {
  const per: Record<string, SubjectTally> = {};
  let present = 0;
  let absent = 0;
  let cancelled = 0;

  for (const [key, status] of Object.entries(log)) {
    const [isoDate, slot] = key.split("|");
    const day = asDayName(new Date(`${isoDate}T00:00:00`));
    if (!day) continue;
    const code = TT[day][slot as SlotKey];
    if (!code) continue;
    const tally = (per[code] ??= { present: 0, absent: 0, cancelled: 0 });
    if (status === "P") { tally.present++; present++; }
    else if (status === "A") { tally.absent++; absent++; }
    else { tally.cancelled++; cancelled++; }
  }
  return { per, present, absent, cancelled, held: present + absent };
}

export function percentage(present: number, held: number): number | null {
  return held ? Math.round((present * 1000) / held) / 10 : null;
}

export function subjectHeld(tally: SubjectTally | undefined): number {
  return tally ? tally.present + tally.absent : 0;
}

export function adviceFor(present: number, held: number, target: number): Advice {
  if (!held) return { verdict: "none", text: "No classes marked yet." };
  const t = target / 100;
  const current = present / held;

  if (current >= t) {
    const canMiss = Math.floor(present / t - held);
    if (canMiss <= 0) return { verdict: "warn", text: "Right on the line — attend the next class to stay safe." };
    return {
      verdict: "ok",
      text: `Safe — you can miss ${canMiss} more class${canMiss > 1 ? "es" : ""} and stay above ${target}%.`,
    };
  }
  const need = Math.ceil((t * held - present) / (1 - t));
  return {
    verdict: "bad",
    text: `Below target — attend the next ${need} class${need > 1 ? "es" : ""} in a row to reach ${target}%.`,
  };
}

/** Risk band used for colour coding across the UI. */
export function riskOf(pct: number | null, target: number): "ok" | "warn" | "bad" | "none" {
  if (pct === null) return "none";
  if (pct >= target) return "ok";
  if (pct >= target - 10) return "warn";
  return "bad";
}

export function subjectName(code: string): string {
  return SUBJECTS[code]?.name ?? code;
}

export function subjectShort(code: string): string {
  return SUBJECTS[code]?.short ?? code;
}
