import type { DayName } from "../types";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as "YYYY-MM-DD" (no UTC shift). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse "YYYY-MM-DD" as a local-midnight Date. */
export function fromISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function weekdayName(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

export function isClassDay(d: Date): d is Date {
  const name = weekdayName(d);
  return name !== "Saturday" && name !== "Sunday";
}

export function asDayName(d: Date): DayName | null {
  const name = weekdayName(d);
  return name === "Saturday" || name === "Sunday" ? null : (name as DayName);
}

export function prettyDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function addDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

/** Minutes since midnight for "HH:MM". */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 || 12;
  return `${h}:${pad(m)} ${ampm}`;
}
