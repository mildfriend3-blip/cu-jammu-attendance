import { DEFAULT_FACULTY_PASSCODE, DEFAULT_SETTINGS } from "../data/timetable";
import type { Account, AccountPublic, Session, Settings, Status } from "../types";
import type { Locks } from "./locks";
import { randomToken } from "./crypto";

const K = {
  accounts: "sentinel.accounts.v1",
  session: "sentinel.session.v1",
  log: (roll: string) => `sentinel.log.v1::${roll.toUpperCase()}`,
  settings: (roll: string) => `sentinel.settings.v1::${roll.toUpperCase()}`,
  locks: (roll: string) => `sentinel.locks.v1::${roll.toUpperCase()}`,
  faculty: "sentinel.faculty.v1",
  theme: "sentinel.theme.v1",
};

export const normaliseRoll = (roll: string) => roll.trim().toUpperCase().replace(/\s+/g, "");
export const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------------------------------------------------------------- accounts */
export function listAccounts(): Account[] {
  return read<Account[]>(K.accounts, []);
}
export function publicAccounts(): AccountPublic[] {
  return listAccounts()
    .map(({ roll, name, role, createdAt, lastSeenAt }) => ({ roll, name, role, createdAt, lastSeenAt }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}
export function findAccount(roll: string): Account | undefined {
  const key = normaliseRoll(roll);
  return listAccounts().find((a) => a.roll === key);
}
export function rollTaken(roll: string): boolean {
  return Boolean(findAccount(roll));
}
export function nameTaken(name: string, exceptRoll?: string): boolean {
  const key = nameKey(name);
  return listAccounts().some((a) => a.nameKey === key && a.roll !== exceptRoll);
}
export function insertAccount(account: Account): void {
  write(K.accounts, [...listAccounts(), account]);
}
export function updateAccount(roll: string, patch: Partial<Account>): Account | undefined {
  const key = normaliseRoll(roll);
  const all = listAccounts();
  const idx = all.findIndex((a) => a.roll === key);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...patch };
  write(K.accounts, all);
  return all[idx];
}
export function accountCount(): number {
  return listAccounts().length;
}

/* ----------------------------------------------------------------- session */
export function startSession(roll: string, remember: boolean): Session {
  const session: Session = {
    roll: normaliseRoll(roll),
    token: randomToken(),
    expiresAt: Date.now() + (remember ? 30 : 1) * 86_400_000,
  };
  const store = remember ? localStorage : sessionStorage;
  store.setItem(K.session, JSON.stringify(session));
  return session;
}
export function readSession(): Session | null {
  const raw = localStorage.getItem(K.session) ?? sessionStorage.getItem(K.session);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (!session?.roll || session.expiresAt < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}
export function clearSession(): void {
  localStorage.removeItem(K.session);
  sessionStorage.removeItem(K.session);
}

/* -------------------------------------------------------------- attendance */
export function loadLog(roll: string): Record<string, Status> {
  return read<Record<string, Status>>(K.log(roll), {});
}
export function saveLog(roll: string, log: Record<string, Status>): void {
  write(K.log(roll), log);
}

/* ------------------------------------------------------------------- locks */
export function loadLocks(roll: string): Locks {
  return read<Locks>(K.locks(roll), {});
}
export function saveLocks(roll: string, locks: Locks): void {
  write(K.locks(roll), locks);
}

/* ---------------------------------------------------------------- settings */
export function loadSettings(roll: string): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K.settings(roll), {}) };
}
export function saveSettings(roll: string, settings: Settings): void {
  write(K.settings(roll), settings);
}

/* ----------------------------------------------------------- faculty gate */
export function loadFacultyPasscode(): string {
  return read<string>(K.faculty, DEFAULT_FACULTY_PASSCODE);
}
export function saveFacultyPasscode(code: string): void {
  write(K.faculty, code);
}

/* ------------------------------------------------------------------ theme */
export function loadTheme(): "dark" | "light" {
  return read<"dark" | "light">(K.theme, "dark");
}
export function saveTheme(theme: "dark" | "light"): void {
  write(K.theme, theme);
}

/* ------------------------------------------------------------------- wipe */
export function eraseStudentData(roll: string): void {
  localStorage.removeItem(K.log(roll));
  localStorage.removeItem(K.settings(roll));
  localStorage.removeItem(K.locks(roll));
}
