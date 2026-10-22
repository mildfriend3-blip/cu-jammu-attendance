import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SETTINGS } from "../data/timetable";
import { computeTotals, logKey, sessionsOn } from "../lib/attendance";
import { downloadFile } from "../lib/export";
import { canEditDay, isLocked, lockDay as lockDate, unlockDay as unlockDate, type Locks } from "../lib/locks";
import {
  eraseStudentData,
  loadLocks,
  loadLog,
  loadSettings,
  saveLocks,
  saveLog,
  saveSettings,
  verifyFacultyPasscode,
} from "../lib/storage";
import type { Settings, SlotKey, Status, Totals } from "../types";
import { useAuth } from "./AuthContext";

interface AttendanceValue {
  log: Record<string, Status>;
  settings: Settings;
  totals: Totals;
  locks: Locks;
  /** True when the day has been submitted and is frozen. */
  isDayLocked: (isoDate: string) => boolean;
  /**
   * All mutating actions return false when the day is locked, so the UI can
   * explain why rather than silently doing nothing. The guard lives here, not in
   * the components, so a locked day cannot be written even if the UI is bypassed.
   */
  setStatus: (isoDate: string, slot: SlotKey, status: Status) => boolean;
  markAllPresent: (isoDate: string) => boolean;
  clearDay: (isoDate: string) => boolean;
  lockDay: (isoDate: string) => void;
  /** Reopens a frozen day. Requires the faculty passcode. */
  unlockDay: (isoDate: string, passcode: string) => Promise<boolean>;
  updateSettings: (patch: Partial<Settings>) => void;
  erase: () => void;
  replaceLog: (log: Record<string, Status>, locks?: Locks) => void;
  exportBackup: () => void;
}

const AttendanceContext = createContext<AttendanceValue | null>(null);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const roll = account?.roll ?? null;

  const [log, setLog] = useState<Record<string, Status>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [locks, setLocks] = useState<Locks>({});

  useEffect(() => {
    if (!roll) {
      setLog({});
      setSettings(DEFAULT_SETTINGS);
      setLocks({});
      return;
    }
    setLog(loadLog(roll));
    setSettings(loadSettings(roll));
    setLocks(loadLocks(roll));
  }, [roll]);

  const commit = useCallback(
    (next: Record<string, Status>) => {
      setLog(next);
      if (roll) saveLog(roll, next);
    },
    [roll],
  );

  const commitLocks = useCallback(
    (next: Locks) => {
      setLocks(next);
      if (roll) saveLocks(roll, next);
    },
    [roll],
  );

  const isDayLocked = useCallback((isoDate: string) => isLocked(locks, isoDate), [locks]);

  const setStatus = useCallback(
    (isoDate: string, slot: SlotKey, status: Status): boolean => {
      if (!canEditDay(locks, isoDate)) return false;
      const key = logKey(isoDate, slot);
      setLog((current) => {
        const next = { ...current };
        if (next[key] === status) delete next[key];
        else next[key] = status;
        if (roll) saveLog(roll, next);
        return next;
      });
      return true;
    },
    [roll, locks],
  );

  const markAllPresent = useCallback(
    (isoDate: string): boolean => {
      if (!canEditDay(locks, isoDate)) return false;
      const next = { ...log };
      for (const session of sessionsOn(isoDate)) next[logKey(isoDate, session.slot)] = "P";
      commit(next);
      return true;
    },
    [log, commit, locks],
  );

  const clearDay = useCallback(
    (isoDate: string): boolean => {
      if (!canEditDay(locks, isoDate)) return false;
      const next = { ...log };
      for (const session of sessionsOn(isoDate)) delete next[logKey(isoDate, session.slot)];
      commit(next);
      return true;
    },
    [log, commit, locks],
  );

  const lockDay = useCallback(
    (isoDate: string) => {
      commitLocks(lockDate(locks, isoDate, roll ?? "unknown"));
    },
    [locks, commitLocks, roll],
  );

  const unlockDay = useCallback(
    async (isoDate: string, passcode: string): Promise<boolean> => {
      if (!(await verifyFacultyPasscode(passcode))) return false;
      commitLocks(unlockDate(locks, isoDate));
      return true;
    },
    [locks, commitLocks],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        if (roll) saveSettings(roll, next);
        return next;
      });
    },
    [roll],
  );

  const erase = useCallback(() => {
    if (roll) eraseStudentData(roll);
    setLog({});
    setSettings(DEFAULT_SETTINGS);
    setLocks({});
  }, [roll]);

  const replaceLog = useCallback(
    (next: Record<string, Status>, nextLocks?: Locks) => {
      commit(next);
      commitLocks(nextLocks ?? {});
    },
    [commit, commitLocks],
  );

  const exportBackup = useCallback(() => {
    if (!roll || !account) return;
    const payload = {
      kind: "cujatt-backup",
      version: 2,
      roll,
      name: account.name,
      settings,
      log,
      locks,
    };
    downloadFile(
      `cujatt-backup-${roll.replace(/[^A-Za-z0-9]+/g, "_")}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  }, [roll, account, settings, log, locks]);

  const totals = useMemo(() => computeTotals(log), [log]);

  const value = useMemo<AttendanceValue>(
    () => ({
      log, settings, totals, locks, isDayLocked,
      setStatus, markAllPresent, clearDay, lockDay, unlockDay,
      updateSettings, erase, replaceLog, exportBackup,
    }),
    [
      log, settings, totals, locks, isDayLocked,
      setStatus, markAllPresent, clearDay, lockDay, unlockDay,
      updateSettings, erase, replaceLog, exportBackup,
    ],
  );

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance(): AttendanceValue {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be used inside <AttendanceProvider>");
  return ctx;
}
