import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { hashPassword, scorePassword, verifyPassword } from "../lib/crypto";
import {
  clearSession,
  findAccount,
  insertAccount,
  nameKey,
  nameTaken,
  normaliseRoll,
  publicAccounts,
  readSession,
  rollTaken,
  startSession,
  updateAccount,
} from "../lib/storage";
import type { AccountPublic, Role } from "../types";

export interface AuthResult {
  ok: boolean;
  message?: string;
  field?: "roll" | "name" | "password";
}

export interface SignUpInput {
  roll: string;
  name: string;
  password: string;
  confirm: string;
  role: Role;
}

interface AuthValue {
  account: AccountPublic | null;
  accounts: AccountPublic[];
  booting: boolean;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signIn: (roll: string, password: string, remember: boolean) => Promise<AuthResult>;
  signOut: () => void;
  refreshAccounts: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

const ROLL_RE = /^[A-Za-z0-9][A-Za-z0-9/_-]{2,23}$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,47}$/;

/** "a", "a and b", "a, b and c" */
function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function validateSignUp(input: SignUpInput): AuthResult | null {
  const roll = normaliseRoll(input.roll);
  const name = input.name.trim();

  if (!roll) return { ok: false, field: "roll", message: "Enter your roll number." };
  if (!ROLL_RE.test(roll)) {
    return {
      ok: false,
      field: "roll",
      message: "3–24 characters: letters, digits, and / - _ only.",
    };
  }
  if (rollTaken(roll)) {
    return { ok: false, field: "roll", message: "That roll number is already registered." };
  }
  if (!name) return { ok: false, field: "name", message: "Enter your full name." };
  if (!NAME_RE.test(name)) {
    return { ok: false, field: "name", message: "Use letters, spaces, and . ' - only." };
  }
  if (nameTaken(name)) {
    return { ok: false, field: "name", message: "That name is already registered on this device." };
  }
  const strength = scorePassword(input.password, roll, name);
  if (strength.problems.length > 0) {
    // Every rejection names a concrete requirement — the list is never empty.
    return {
      ok: false,
      field: "password",
      message: `Password needs ${formatList(strength.problems)}.`,
    };
  }
  if (input.password !== input.confirm) {
    return { ok: false, field: "password", message: "Passwords do not match." };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountPublic | null>(null);
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [booting, setBooting] = useState(true);

  const refreshAccounts = useCallback(() => setAccounts(publicAccounts()), []);

  useEffect(() => {
    const session = readSession();
    if (session) {
      const found = findAccount(session.roll);
      if (found) {
        updateAccount(found.roll, { lastSeenAt: Date.now() });
        setAccount({ roll: found.roll, name: found.name, role: found.role, createdAt: found.createdAt, lastSeenAt: Date.now() });
      } else {
        clearSession();
      }
    }
    refreshAccounts();
    setBooting(false);
  }, [refreshAccounts]);

  const signUp = useCallback(
    async (input: SignUpInput): Promise<AuthResult> => {
      const problem = validateSignUp(input);
      if (problem) return problem;

      const roll = normaliseRoll(input.roll);
      const name = input.name.trim();
      const { salt, hash, iterations } = await hashPassword(input.password);
      const now = Date.now();

      insertAccount({
        roll,
        name,
        nameKey: nameKey(name),
        salt,
        hash,
        iterations,
        role: input.role,
        createdAt: now,
        lastSeenAt: now,
      });
      startSession(roll, true);
      setAccount({ roll, name, role: input.role, createdAt: now, lastSeenAt: now });
      refreshAccounts();
      return { ok: true };
    },
    [refreshAccounts],
  );

  const signIn = useCallback(
    async (rollInput: string, password: string, remember: boolean): Promise<AuthResult> => {
      const roll = normaliseRoll(rollInput);
      if (!roll) return { ok: false, field: "roll", message: "Enter your roll number." };
      if (!password) return { ok: false, field: "password", message: "Enter your password." };

      const found = findAccount(roll);
      // Same generic message either way so the form can't be used to enumerate rolls.
      const generic: AuthResult = { ok: false, field: "password", message: "Roll number or password is incorrect." };
      if (!found) return generic;

      const valid = await verifyPassword(password, found);
      if (!valid) return generic;

      const now = Date.now();
      updateAccount(roll, { lastSeenAt: now });
      startSession(roll, remember);
      setAccount({ roll, name: found.name, role: found.role, createdAt: found.createdAt, lastSeenAt: now });
      refreshAccounts();
      return { ok: true };
    },
    [refreshAccounts],
  );

  const signOut = useCallback(() => {
    clearSession();
    setAccount(null);
    refreshAccounts();
  }, [refreshAccounts]);

  const value = useMemo<AuthValue>(
    () => ({ account, accounts, booting, signUp, signIn, signOut, refreshAccounts }),
    [account, accounts, booting, signUp, signIn, signOut, refreshAccounts],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
