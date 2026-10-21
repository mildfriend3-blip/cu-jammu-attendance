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
import { eraseStudentData, loadLog, loadSettings, saveLog, saveSettings } from "../lib/storage";
import type { Settings, SlotKey, Status, Totals } from "../types";
import { useAuth } from "./AuthContext";

interface AttendanceValue {
  log: Record<string, Status>;
  settings: Settings;
  totals: Totals;
  setStatus: (isoDate: string, slot: SlotKey, status: Status) => void;
  markAllPresent: (isoDate: string) => void;
  clearDay: (isoDate: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  erase: () => void;
  replaceLog: (log: Record<string, Status>) => void;
  exportBackup: () => void;
}

const AttendanceContext = createContext<AttendanceValue | null>(null);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const roll = account?.roll ?? null;

  const [log, setLog] = useState<Record<string, Status>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!roll) {
      setLog({});
      setSettings(DEFAULT_SETTINGS);
      return;
    }
    setLog(loadLog(roll));
    setSettings(loadSettings(roll));
  }, [roll]);

  const commit = useCallback(
    (next: Record<string, Status>) => {
      setLog(next);
      if (roll) saveLog(roll, next);
    },
    [roll],
  );

  const setStatus = useCallback(
    (isoDate: string, slot: SlotKey, status: Status) => {
      const key = logKey(isoDate, slot);
      setLog((current) => {
        const next = { ...current };
        if (next[key] === status) delete next[key];
        else next[key] = status;
        if (roll) saveLog(roll, next);
        return next;
      });
    },
    [roll],
  );

  const markAllPresent = useCallback(
    (isoDate: string) => {
      const next = { ...log };
      for (const session of sessionsOn(isoDate)) next[logKey(isoDate, session.slot)] = "P";
      commit(next);
    },
    [log, commit],
  );

  const clearDay = useCallback(
    (isoDate: string) => {
      const next = { ...log };
      for (const session of sessionsOn(isoDate)) delete next[logKey(isoDate, session.slot)];
      commit(next);
    },
    [log, commit],
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
  }, [roll]);

  const replaceLog = useCallback(
    (next: Record<string, Status>) => commit(next),
    [commit],
  );

  const exportBackup = useCallback(() => {
    if (!roll || !account) return;
    const payload = { kind: "sentinel-backup", version: 1, roll, name: account.name, settings, log };
    downloadFile(
      `sentinel-backup-${roll.replace(/[^A-Za-z0-9]+/g, "_")}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  }, [roll, account, settings, log]);

  const totals = useMemo(() => computeTotals(log), [log]);

  const value = useMemo<AttendanceValue>(
    () => ({
      log, settings, totals,
      setStatus, markAllPresent, clearDay, updateSettings, erase, replaceLog, exportBackup,
    }),
    [log, settings, totals, setStatus, markAllPresent, clearDay, updateSettings, erase, replaceLog, exportBackup],
  );

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance(): AttendanceValue {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be used inside <AttendanceProvider>");
  return ctx;
}
