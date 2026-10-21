export type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
export type SlotKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";
export type Status = "P" | "A" | "C";
export type Role = "student" | "faculty";

export interface Subject {
  code: string;
  name: string;
  short: string;
  faculty: string;
  /** CSS custom property holding this subject's hue. */
  hue: string;
}

export interface SlotMeta {
  key: SlotKey;
  label: string;
  time: string;
}

/** A student account. Secrets live here; never expose this to the UI directly. */
export interface Account {
  roll: string;
  name: string;
  /** lowercased name, used to enforce uniqueness */
  nameKey: string;
  salt: string;
  hash: string;
  iterations: number;
  role: Role;
  createdAt: number;
  lastSeenAt: number;
}

/** Account shape safe to render. */
export interface AccountPublic {
  roll: string;
  name: string;
  role: Role;
  createdAt: number;
  lastSeenAt: number;
}

export interface Session {
  roll: string;
  token: string;
  expiresAt: number;
}

export interface Settings {
  target: number;
  notifyLowAttendance: boolean;
  notifyClassReminder: boolean;
  reminderLeadMinutes: number;
  examDate: string | null;
}

export interface SubjectTally {
  present: number;
  absent: number;
  cancelled: number;
}

export interface Totals {
  per: Record<string, SubjectTally>;
  present: number;
  absent: number;
  cancelled: number;
  held: number;
}

export interface SessionEntry {
  slot: SlotKey;
  code: string;
}

export type Verdict = "ok" | "warn" | "bad" | "none";

export interface Advice {
  verdict: Verdict;
  text: string;
}

export interface DaySeriesPoint {
  date: string;
  present: number;
  absent: number;
  rate: number | null;
}

export interface HeatCell {
  date: string;
  level: 0 | 1 | 2 | 3 | 4 | null;
  title: string;
}
