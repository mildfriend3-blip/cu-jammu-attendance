import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { logKey } from "../lib/attendance";
import { loadRecord, listRecords, normaliseRoll, saveRecord } from "../lib/storage";
import type { SlotKey, Status, StudentRecord } from "../types";

interface SignInResult {
  ok: boolean;
  message?: string;
}

interface StudentContextValue {
  student: StudentRecord | null;
  saved: StudentRecord[];
  toast: string | null;
  signIn: (roll: string, name: string) => SignInResult;
  signOut: () => void;
  setStatus: (isoDate: string, slot: SlotKey, status: Status) => void;
  setMany: (isoDate: string, entries: Array<{ slot: SlotKey; status: Status | null }>) => void;
  setTarget: (target: number) => void;
  eraseLog: () => void;
  importRecord: (record: StudentRecord) => void;
  showToast: (message: string) => void;
  refreshSaved: () => void;
}

const StudentContext = createContext<StudentContextValue | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [saved, setSaved] = useState<StudentRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const refreshSaved = useCallback(() => setSaved(listRecords()), []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const persist = useCallback((next: StudentRecord) => {
    saveRecord(next);
    setStudent({ ...next });
    refreshSaved();
  }, [refreshSaved]);

  const signIn = useCallback(
    (rollRaw: string, nameRaw: string): SignInResult => {
      const roll = normaliseRoll(rollRaw);
      if (!roll) return { ok: false, message: "Enter your roll number." };

      const existing = loadRecord(roll);
      if (existing) {
        const name = nameRaw.trim();
        const next = name && name !== existing.name ? { ...existing, name } : existing;
        persist(next);
        return { ok: true };
      }

      const name = nameRaw.trim();
      if (!name) return { ok: false, message: "Add your name to create a new record." };

      const now = Date.now();
      const record: StudentRecord = {
        roll,
        name,
        target: 75,
        createdAt: now,
        updatedAt: now,
        log: {},
      };
      persist(record);
      return { ok: true };
    },
    [persist],
  );

  const signOut = useCallback(() => {
    setStudent(null);
    refreshSaved();
  }, [refreshSaved]);

  const mutate = useCallback(
    (fn: (log: Record<string, Status>) => void) => {
      setStudent((current) => {
        if (!current) return current;
        const log = { ...current.log };
        fn(log);
        const next = { ...current, log };
        saveRecord(next);
        return next;
      });
    },
    [],
  );

  const setStatus = useCallback(
    (isoDate: string, slot: SlotKey, status: Status) => {
      mutate((log) => {
        const key = logKey(isoDate, slot);
        if (log[key] === status) delete log[key];
        else log[key] = status;
      });
      refreshSaved();
    },
    [mutate, refreshSaved],
  );

  const setMany = useCallback(
    (isoDate: string, entries: Array<{ slot: SlotKey; status: Status | null }>) => {
      mutate((log) => {
        for (const { slot, status } of entries) {
          const key = logKey(isoDate, slot);
          if (status === null) delete log[key];
          else log[key] = status;
        }
      });
      refreshSaved();
    },
    [mutate, refreshSaved],
  );

  const setTarget = useCallback(
    (target: number) => {
      setStudent((current) => {
        if (!current) return current;
        const next = { ...current, target };
        saveRecord(next);
        return next;
      });
    },
    [],
  );

  const eraseLog = useCallback(() => {
    mutate((log) => {
      for (const key of Object.keys(log)) delete log[key];
    });
    refreshSaved();
  }, [mutate, refreshSaved]);

  const importRecord = useCallback(
    (record: StudentRecord) => {
      const clean: StudentRecord = {
        ...record,
        target: record.target ?? 75,
        log: record.log ?? {},
        updatedAt: Date.now(),
      };
      persist(clean);
    },
    [persist],
  );

  const value = useMemo<StudentContextValue>(
    () => ({
      student,
      saved,
      toast,
      signIn,
      signOut,
      setStatus,
      setMany,
      setTarget,
      eraseLog,
      importRecord,
      showToast,
      refreshSaved,
    }),
    [
      student,
      saved,
      toast,
      signIn,
      signOut,
      setStatus,
      setMany,
      setTarget,
      eraseLog,
      importRecord,
      showToast,
      refreshSaved,
    ],
  );

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentContextValue {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used inside <StudentProvider>");
  return ctx;
}
