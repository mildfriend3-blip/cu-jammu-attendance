/** Shared domain types for the timetable + attendance app. */

export type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";

export type SlotKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";

/** Attendance status for one scheduled class on one date. */
export type Status = "P" | "A" | "C";

export interface Subject {
  code: string;
  name: string;
  faculty: string;
  /** CSS custom-property name holding this subject's accent colour. */
  color: string;
}

export interface SlotMeta {
  key: SlotKey;
  /** Department slot label, e.g. "A-Core". */
  label: string;
  /** Display time range, e.g. "09:30–10:15". */
  time: string;
}

/** A student's locally-stored record. */
export interface StudentRecord {
  roll: string;
  name: string;
  /** Required attendance percentage, e.g. 75. */
  target: number;
  createdAt: number;
  updatedAt: number;
  /** Attendance log. Key is `"YYYY-MM-DD|slot"`, value is the status. */
  log: Record<string, Status>;
}

/** One scheduled class resolved for a particular date. */
export interface Session {
  slot: SlotKey;
  code: string;
}

/** Aggregated counts for a single subject. */
export interface SubjectTally {
  present: number;
  absent: number;
  cancelled: number;
}

export type Verdict = "good" | "warn" | "bad" | "none";
