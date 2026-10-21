import { TT, SUBJECTS } from "../data/timetable";
import { asDayName } from "./date";
import type {
  DayName,
  Session,
  SlotKey,
  Status,
  StudentRecord,
  SubjectTally,
  Verdict,
} from "../types";

/** Log key for one class occurrence. */
export const logKey = (isoDate: string, slot: SlotKey): string => `${isoDate}|${slot}`;

/** All classes scheduled on a given "YYYY-MM-DD". */
export function sessionsOn(isoDate: string): Session[] {
  const day = asDayName(new Date(`${isoDate}T00:00:00`));
  if (!day) return [];
  const row = TT[day];
  return (Object.keys(row) as SlotKey[])
    .map((slot) => ({ slot, code: row[slot] as string }))
    .sort((a, b) => a.slot.localeCompare(b.slot));
}

export function subjectFor(day: DayName, slot: SlotKey): string | undefined {
  return TT[day][slot];
}

export interface Totals {
  per: Record<string, SubjectTally>;
  present: number;
  absent: number;
  held: number;
}

/** Roll the whole log up into per-subject and overall counts. */
export function computeTotals(log: Record<string, Status>): Totals {
  const per: Record<string, SubjectTally> = {};
  let present = 0;
  let absent = 0;

  for (const [key, status] of Object.entries(log)) {
    const [isoDate, slot] = key.split("|");
    const day = asDayName(new Date(`${isoDate}T00:00:00`));
    if (!day) continue;
    const code = TT[day][slot as SlotKey];
    if (!code) continue;

    const tally = (per[code] ??= { present: 0, absent: 0, cancelled: 0 });
    if (status === "P") {
      tally.present++;
      present++;
    } else if (status === "A") {
      tally.absent++;
      absent++;
    } else {
      tally.cancelled++;
    }
  }

  return { per, present, absent, held: present + absent };
}

/** Percentage to one decimal place, or null when nothing has been held. */
export function percentage(present: number, held: number): number | null {
  return held ? Math.round((present * 1000) / held) / 10 : null;
}

export interface Advice {
  verdict: Verdict;
  text: string;
}

/**
 * Bunk maths. If above target, how many classes can be missed and stay above;
 * if below, how many must be attended in a row to climb back.
 */
export function adviceFor(present: number, held: number, target: number): Advice {
  if (!held) return { verdict: "none", text: "No classes marked yet." };

  const t = target / 100;
  const current = present / held;

  if (current >= t) {
    const canMiss = Math.floor(present / t - held);
    if (canMiss <= 0) {
      return { verdict: "warn", text: "Right at the line — attend the next class to stay safe." };
    }
    return {
      verdict: "good",
      text: `You can miss up to ${canMiss} class${canMiss > 1 ? "es" : ""} and still stay above ${target}%.`,
    };
  }

  const need = Math.ceil((t * held - present) / (1 - t));
  return {
    verdict: "bad",
    text: `Below target — attend the next ${need} class${need > 1 ? "es" : ""} in a row to reach ${target}%.`,
  };
}

export function subjectName(code: string): string {
  return SUBJECTS[code]?.name ?? code;
}

/** Colour token for a subject, falling back to a neutral. */
export function subjectColor(code: string): string {
  return `var(${SUBJECTS[code]?.color ?? "--ink-3"})`;
}

export function recordCount(record: StudentRecord): number {
  return Object.keys(record.log).length;
}
