/**
 * Semester I (I-CCS) schedule — B.Tech Cyber Security,
 * Department of CSE & CSIT, Cluster University of Jammu.
 * 2026-27 odd semester, effective 7 September 2026.
 */
import type { DayName, SlotKey, SlotMeta, Subject } from "../types";

export const META = {
  product: "CUJ Attendance",
  university: "Cluster University of Jammu",
  department: "Department of CSE & CSIT",
  programme: "B.Tech Cyber Security",
  semester: "Semester I",
  classTag: "I-CCS",
  room: "Fabricated Building Lab-2",
  term: "2026–27 Odd Semester (July–December 2026)",
  effectiveFrom: "7 September 2026",
  version: "2.0.0",
} as const;

export const DAYS: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const SLOTS: SlotMeta[] = [
  { key: "A", label: "A-Core", time: "09:30–10:15" },
  { key: "B", label: "B-Core", time: "10:15–11:00" },
  { key: "C", label: "C-Core", time: "11:00–11:45" },
  { key: "D", label: "D-Core", time: "11:45–12:30" },
  { key: "E", label: "E-Core", time: "14:00–14:45" },
  { key: "F", label: "F-Core", time: "14:45–15:30" },
  { key: "G", label: "G-Core", time: "15:30–16:15" },
  { key: "H", label: "H-Open Elective", time: "16:15–17:00" },
  { key: "I", label: "I-Open Elective", time: "17:00–17:45" },
];

export const LUNCH = { label: "Lunch", time: "12:30–14:00" } as const;

export const SLOT_BY_KEY: Record<SlotKey, SlotMeta> = SLOTS.reduce(
  (acc, s) => ({ ...acc, [s.key]: s }),
  {} as Record<SlotKey, SlotMeta>,
);

export const SUBJECTS: Record<string, Subject> = {
  IBBA1O01: {
    code: "IBBA1O01",
    name: "Introduction to Entrepreneurship & Startup",
    short: "Entrepreneurship",
    faculty: "SM",
    hue: "--s4",
  },
  IMAT1C03: {
    code: "IMAT1C03",
    name: "Mathematics for Engineering",
    short: "Mathematics",
    faculty: "GF Maths — Dr. Arun Bali",
    hue: "--s2",
  },
  BCCS1C01: {
    code: "BCCS1C01",
    name: "Python Programming",
    short: "Python",
    faculty: "HK",
    hue: "--s1",
  },
  BCCS1C02: {
    code: "BCCS1C02",
    name: "Computer Programming",
    short: "C Programming",
    faculty: "JPS",
    hue: "--s3",
  },
  BENG1O05: {
    code: "BENG1O05",
    name: "Professional Communication",
    short: "Comm. Skills",
    faculty: "GF English",
    hue: "--s5",
  },
  BECE1C02: {
    code: "BECE1C02",
    name: "Electrical & Electronics (E&E)",
    short: "E&E",
    faculty: "Dr. Rajiv Kumar",
    hue: "--s6",
  },
  IEVS1O04: {
    code: "IEVS1O04",
    name: "Environmental Studies (EVS)",
    short: "EVS",
    faculty: "MOOC",
    hue: "--s7",
  },
};

export const TT: Record<DayName, Partial<Record<SlotKey, string>>> = {
  Monday: { A: "IBBA1O01", B: "BCCS1C02", C: "BENG1O05", D: "BECE1C02", E: "BECE1C02", H: "IEVS1O04" },
  Tuesday: { A: "IBBA1O01", B: "IMAT1C03", C: "IMAT1C03", D: "BECE1C02", E: "BENG1O05", F: "BENG1O05" },
  Wednesday: { A: "IBBA1O01", B: "BECE1C02", C: "BCCS1C01", D: "BCCS1C02", E: "BCCS1C01" },
  Thursday: { A: "IMAT1C03", B: "BCCS1C01", C: "BCCS1C02", D: "BENG1O05", E: "BCCS1C02", H: "IEVS1O04" },
  Friday: { A: "BECE1C02", B: "BCCS1C01", C: "BCCS1C02", D: "IMAT1C03", E: "IMAT1C03", F: "IEVS1O04", G: "IEVS1O04" },
};

/** Sessions flagged as labs/practicals, keyed `"Day|slot"`. */
export const LAB_SESSIONS: ReadonlySet<string> = new Set([
  "Monday|E",
  "Tuesday|F",
  "Wednesday|E",
  "Thursday|E",
]);

/** Extra notes surfaced on a class card, keyed `"Day|slot"`. */
export const SESSION_NOTES: Record<string, string> = {
  "Monday|E": "E&E Lab — ECE Department",
  "Tuesday|E": "Held in PMMMTT Lab",
  "Tuesday|F": "Professional Communication Lab",
  "Wednesday|E": "Python Lab [Lab 4]",
  "Thursday|E": "Computer Programming Lab [Lab 4]",
  "Friday|A": "Venue: Class 6",
  "Friday|B": "Venue: Class 6",
  "Friday|C": "Venue: Class 6",
  "Friday|D": "Venue: Class 6",
};

export const DEFAULT_SETTINGS = {
  target: 75,
  notifyLowAttendance: true,
  notifyClassReminder: true,
  reminderLeadMinutes: 15,
  examDate: null as string | null,
};

/** Default faculty passcode for the admin console (changeable in Settings). */
export const DEFAULT_FACULTY_PASSCODE = "sentinel";
