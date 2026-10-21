import type { DayName } from "../types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}
export function weekdayName(d: Date): string {
  return WEEKDAYS[d.getDay()];
}
export function asDayName(d: Date): DayName | null {
  const name = weekdayName(d);
  return name === "Saturday" || name === "Sunday" ? null : (name as DayName);
}
export function isWeekend(d: Date): boolean {
  return asDayName(d) === null;
}
export function prettyDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
export function shortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
export function addDays(d: Date, delta: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + delta);
  return n;
}
export function startOfWeek(d: Date): Date {
  const n = new Date(d);
  const shift = (n.getDay() + 6) % 7; // Monday-based
  n.setDate(n.getDate() - shift);
  n.setHours(0, 0, 0, 0);
  return n;
}
export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function formatMinutes(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  return `${h24 % 12 || 12}:${pad(m)} ${ap}`;
}
export function daysBetween(a: Date, b: Date): number {
  const ms = fromISODate(toISODate(b)).getTime() - fromISODate(toISODate(a)).getTime();
  return Math.round(ms / 86_400_000);
}
export function relativeDay(iso: string, now = new Date()): string {
  const diff = daysBetween(now, fromISODate(iso));
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return prettyDate(fromISODate(iso));
}
