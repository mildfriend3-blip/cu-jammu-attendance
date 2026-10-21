/**
 * CSV parsing and validation for faculty bulk attendance import.
 *
 * Kept free of React and of localStorage so the rules can be unit-tested
 * directly (see scripts/test-csv.mjs).
 */
import { TT } from "../data/timetable";
import { asDayName, toISODate } from "./date";
import { toCSV } from "./export";
import type { SlotKey, Status } from "../types";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** Non-fatal notes, e.g. a detected delimiter or skipped blank lines. */
  notes: string[];
}

const DELIMITERS = [",", ";", "\t"] as const;

function detectDelimiter(headerLine: string): string {
  let best = ",";
  let bestCount = -1;
  for (const d of DELIMITERS) {
    const count = headerLine.split(d).length;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF, blank-line tolerant. */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, ""); // strip BOM
  const lines = clean.split(/\r\n|\n|\r/);
  const notes: string[] = [];
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? "";
  const delimiter = detectDelimiter(firstNonEmpty);
  if (delimiter !== ",") {
    notes.push(`Detected "${delimiter === "\t" ? "tab" : delimiter}" as the column separator.`);
  }

  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      rows.push(record);
      record = [];
      field = "";
    } else if (ch === "\r") {
      // handled with \n; a lone \r acts as a break too
      if (clean[i + 1] !== "\n") {
        record.push(field);
        rows.push(record);
        record = [];
        field = "";
      }
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    rows.push(record);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
  const [header, ...body] = nonEmpty;
  return {
    headers: (header ?? []).map((h) => h.trim()),
    rows: body,
    notes,
  };
}

export interface ImportRow {
  roll: string;
  iso: string;
  slot: SlotKey;
  status: Status;
  line: number;
}

export interface ImportIssue {
  line: number;
  raw: string;
  message: string;
}

export interface ImportPreview {
  rows: ImportRow[];
  issues: ImportIssue[];
  notes: string[];
  /** Rows that would overwrite an existing mark. */
  overwrites: number;
}

const SLOT_KEYS: SlotKey[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

function normaliseStatus(raw: string): Status | null {
  const v = raw.trim().toLowerCase();
  if (["p", "present", "y", "yes", "1", "attended"].includes(v)) return "P";
  if (["a", "absent", "n", "no", "0", "missed"].includes(v)) return "A";
  if (["c", "cancelled", "canceled", "cancel", "off", "holiday"].includes(v)) return "C";
  return null;
}

/** Accepts YYYY-MM-DD or D/M/YYYY (day-first, Indian convention). */
export function normaliseDate(raw: string): string | null {
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : v;
  }
  const m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return toISODate(d);
  }
  return null;
}

function columnIndex(headers: string[], ...names: string[]): number {
  const normalised = headers.map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ""));
  for (const name of names) {
    const key = name.toLowerCase().replace(/[\s_-]+/g, "");
    const idx = normalised.indexOf(key);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Validate an attendance CSV against the known accounts and the timetable.
 * Every row is checked; bad rows are reported with their line number rather
 * than aborting the whole import.
 */
export function parseAttendanceCsv(
  text: string,
  knownRolls: ReadonlySet<string>,
  /** Keys of the form `ROLL|YYYY-MM-DD|slot` already recorded. */
  existingKeys: ReadonlySet<string> = new Set(),
): ImportPreview {
  const { headers, rows, notes } = parseCsv(text);
  const issues: ImportIssue[] = [];

  const iRoll = columnIndex(headers, "roll", "rollno", "rollnumber", "enrollment");
  const iDate = columnIndex(headers, "date", "day");
  const iSlot = columnIndex(headers, "slot", "period", "hour");
  const iStatus = columnIndex(headers, "status", "attendance", "mark", "present");

  if (iRoll === -1 || iDate === -1 || iSlot === -1 || iStatus === -1) {
    const missing = [
      iRoll === -1 ? "roll" : null,
      iDate === -1 ? "date" : null,
      iSlot === -1 ? "slot" : null,
      iStatus === -1 ? "status" : null,
    ].filter(Boolean);
    return {
      rows: [],
      issues: [{ line: 1, raw: headers.join(","), message: `Missing required column(s): ${missing.join(", ")}` }],
      notes,
      overwrites: 0,
    };
  }

  const out: ImportRow[] = [];
  const seen = new Set<string>();
  let overwrites = 0;

  rows.forEach((cells, index) => {
    const line = index + 2; // header is line 1
    const raw = cells.join(",");
    if (cells.every((c) => !c.trim())) return;

    const roll = (cells[iRoll] ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const dateRaw = (cells[iDate] ?? "").trim();
    const slotRaw = (cells[iSlot] ?? "").trim().toUpperCase();
    const statusRaw = (cells[iStatus] ?? "").trim();

    if (!roll) return void issues.push({ line, raw, message: "Missing roll number." });
    if (!knownRolls.has(roll)) {
      return void issues.push({ line, raw, message: `Roll "${roll}" is not registered on this device.` });
    }

    const iso = normaliseDate(dateRaw);
    if (!iso) return void issues.push({ line, raw, message: `Unreadable date "${dateRaw}" (use YYYY-MM-DD).` });

    const day = asDayName(new Date(`${iso}T00:00:00`));
    if (!day) return void issues.push({ line, raw, message: `${iso} is a weekend — no classes.` });

    if (!SLOT_KEYS.includes(slotRaw as SlotKey)) {
      return void issues.push({ line, raw, message: `Unknown slot "${slotRaw}" (expected A–I).` });
    }
    const slot = slotRaw as SlotKey;
    if (!TT[day][slot]) {
      return void issues.push({ line, raw, message: `No class in slot ${slot} on ${day}.` });
    }

    const status = normaliseStatus(statusRaw);
    if (!status) {
      return void issues.push({
        line,
        raw,
        message: `Unreadable status "${statusRaw}" (use P/A/C or present/absent/cancelled).`,
      });
    }

    const key = `${roll}|${iso}|${slot}`;
    if (seen.has(key)) return void issues.push({ line, raw, message: `Duplicate row for ${roll} ${iso} slot ${slot}.` });
    seen.add(key);

    if (existingKeys.has(`${roll}|${iso}|${slot}`)) overwrites++;
    out.push({ roll, iso, slot, status, line });
  });

  return { rows: out, issues, notes, overwrites };
}

/** Grouped, apply-ready form: one log patch per student. */
export function groupByRoll(rows: ImportRow[]): Map<string, ImportRow[]> {
  const map = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const list = map.get(row.roll) ?? [];
    list.push(row);
    map.set(row.roll, list);
  }
  return map;
}

export function templateCsv(): string {
  return toCSV([
    ["roll", "date", "slot", "status"],
    ["26BECCS533", "2026-10-20", "A", "P"],
    ["26BECCS533", "2026-10-20", "B", "A"],
    ["26BECCS501", "2026-10-20", "A", "P"],
    ["26BECCS501", "2026-10-20", "B", "C"],
  ]);
}

export function importReportCsv(rows: ImportRow[], issues: ImportIssue[]): string {
  const out: (string | number)[][] = [["result", "line", "roll", "date", "slot", "status", "message"]];
  for (const r of rows) out.push(["applied", r.line, r.roll, r.iso, r.slot, r.status, ""]);
  for (const i of issues) out.push(["skipped", i.line, "", "", "", "", i.message]);
  return toCSV(out);
}
