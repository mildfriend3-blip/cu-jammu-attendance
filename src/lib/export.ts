import { SUBJECTS, TT } from "../data/timetable";
import { asDayName } from "./date";
import { computeTotals, percentage, subjectHeld } from "./attendance";
import type { SlotKey, Status } from "../types";

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Subject-level summary for one student. */
export function subjectSummaryCSV(roll: string, name: string, log: Record<string, Status>, target: number): string {
  const totals = computeTotals(log);
  const rows: (string | number)[][] = [
    ["Roll", "Name", "Subject Code", "Subject", "Faculty", "Present", "Absent", "Cancelled", "Held", "Percent", "Target", "Status"],
  ];
  for (const subject of Object.values(SUBJECTS)) {
    const tally = totals.per[subject.code] ?? { present: 0, absent: 0, cancelled: 0 };
    const held = subjectHeld(tally);
    const pct = percentage(tally.present, held);
    rows.push([
      roll, name, subject.code, subject.name, subject.faculty,
      tally.present, tally.absent, tally.cancelled, held,
      pct === null ? "" : pct.toFixed(1),
      target,
      pct === null ? "no data" : pct >= target ? "OK" : "SHORT",
    ]);
  }
  return toCSV(rows);
}

/** One row per marked class — the full audit trail. */
export function attendanceLogCSV(roll: string, name: string, log: Record<string, Status>): string {
  const rows: (string | number)[][] = [["Roll", "Name", "Date", "Weekday", "Slot", "Subject Code", "Subject", "Status"]];
  const keys = Object.keys(log).sort();
  for (const key of keys) {
    const [iso, slot] = key.split("|");
    const day = asDayName(new Date(`${iso}T00:00:00`));
    const code = day ? TT[day][slot as SlotKey] : undefined;
    rows.push([
      roll,
      name,
      iso,
      day ?? "",
      slot,
      code ?? "",
      code ? SUBJECTS[code]?.name ?? code : "",
      log[key],
    ]);
  }
  return toCSV(rows);
}

/** Roster overview across every account on this device. */
export function rosterCSV(
  entries: { roll: string; name: string; present: number; held: number; pct: number | null; target: number }[],
): string {
  const rows: (string | number)[][] = [["Roll", "Name", "Present", "Held", "Percent", "Target", "Status"]];
  for (const e of entries) {
    rows.push([
      e.roll, e.name, e.present, e.held,
      e.pct === null ? "" : e.pct.toFixed(1),
      e.target,
      e.pct === null ? "no data" : e.pct >= e.target ? "OK" : "SHORT",
    ]);
  }
  return toCSV(rows);
}

