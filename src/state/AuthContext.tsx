import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PBKDF2_ITERATIONS, hashPassword, scorePassword, verifyPassword } from "../lib/crypto";
import {
  isRecoveryCodeAcceptable,
  normaliseRecoveryCode,
  validateNewPassword,
} from "../lib/recovery";
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

/** Which control an error belongs to, so the form can highlight the right field. */
export type AuthField = "roll" | "name" | "password" | "recovery" | "current" | "next" | "code";

export interface AuthResult {
  ok: boolean;
  message?: string;
  field?: AuthField;
}

export interface SignUpInput {
  roll: string;
  name: string;
  password: string;
  confirm: string;
  role: Role;
  /** Optional self-service recovery code. Without one, only faculty can reset. */
  recoveryCode?: string;
}

interface AuthValue {
  account: AccountPublic | null;
  accounts: AccountPublic[];
  booting: boolean;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signIn: (roll: string, password: string, remember: boolean) => Promise<AuthResult>;
  signOut: () => void;
  refreshAccounts: () => void;
  /** True when the account has a recovery code, so self-service reset is possible. */
  hasRecovery: (roll: string) => boolean;
  setRecoveryCode: (code: string) => Promise<AuthResult>;
  changePassword: (current: string, next: string) => Promise<AuthResult>;
  resetWithRecoveryCode: (roll: string, code: string, next: string) => Promise<AuthResult>;
  /** Faculty-side reset from the console; the console is already passcode gated. */
  facultyResetPassword: (roll: string, tempPassword: string) => Promise<AuthResult>;
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
  if (input.recoveryCode && !isRecoveryCodeAcceptable(input.recoveryCode)) {
    return { ok: false, field: "recovery", message: "Recovery code needs at least 8 characters." };
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

      const recovery = input.recoveryCode?.trim()
        ? await hashPassword(normaliseRecoveryCode(input.recoveryCode))
        : null;

      insertAccount({
        roll,
        name,
        nameKey: nameKey(name),
        salt,
        hash,
        iterations,
        recoverySalt: recovery?.salt,
        recoveryHash: recovery?.hash,
        recoveryIterations: recovery?.iterations,
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

  const hasRecovery = useCallback((roll: string) => Boolean(findAccount(roll)?.recoveryHash), []);

  const setRecoveryCode = useCallback(
    async (code: string): Promise<AuthResult> => {
      if (!account) return { ok: false, message: "Not signed in." };
      if (!isRecoveryCodeAcceptable(code)) {
        return { ok: false, field: "recovery", message: "Recovery code needs at least 8 characters." };
      }
      const { salt, hash, iterations } = await hashPassword(normaliseRecoveryCode(code));
      updateAccount(account.roll, {
        recoverySalt: salt,
        recoveryHash: hash,
        recoveryIterations: iterations,
      });
      return { ok: true };
    },
    [account],
  );

  const changePassword = useCallback(
    async (current: string, next: string): Promise<AuthResult> => {
      if (!account) return { ok: false, message: "Not signed in." };
      const found = findAccount(account.roll);
      if (!found) return { ok: false, message: "Account not found on this device." };
      if (!(await verifyPassword(current, found))) {
        return { ok: false, field: "current", message: "Current password is incorrect." };
      }
      const check = validateNewPassword(next, next, found.roll, found.name);
      if (!check.ok) return { ok: false, field: "next", message: check.message };
      const { salt, hash, iterations } = await hashPassword(next);
      updateAccount(found.roll, { salt, hash, iterations });
      return { ok: true };
    },
    [account],
  );

  const resetWithRecoveryCode = useCallback(
    async (rollInput: string, code: string, next: string): Promise<AuthResult> => {
      const roll = normaliseRoll(rollInput);
      if (!roll) return { ok: false, field: "roll", message: "Enter your roll number." };
      const found = findAccount(roll);

      // Same wording whether the account or the code is wrong, so the form cannot
      // be used to discover which roll numbers exist.
      const wrong: AuthResult = {
        ok: false,
        field: "code",
        message: "Roll number or recovery code is incorrect.",
      };
      if (!found) return wrong;
      if (!found.recoveryHash || !found.recoverySalt) {
        return {
          ok: false,
          field: "code",
          message: "No recovery code is set for that roll number — ask faculty to reset it.",
        };
      }

      const valid = await verifyPassword(normaliseRecoveryCode(code), {
        salt: found.recoverySalt,
        hash: found.recoveryHash,
        iterations: found.recoveryIterations ?? PBKDF2_ITERATIONS,
      });
      if (!valid) return wrong;

      const check = validateNewPassword(next, next, found.roll, found.name);
      if (!check.ok) return { ok: false, field: "next", message: check.message };

      const { salt, hash, iterations } = await hashPassword(next);
      updateAccount(found.roll, { salt, hash, iterations });
      return { ok: true };
    },
    [],
  );

  const facultyResetPassword = useCallback(
    async (rollInput: string, tempPassword: string): Promise<AuthResult> => {
      const roll = normaliseRoll(rollInput);
      const found = findAccount(roll);
      if (!found) return { ok: false, message: "No such account on this device." };
      const check = validateNewPassword(tempPassword, tempPassword, found.roll, found.name);
      if (!check.ok) return { ok: false, message: check.message };
      const { salt, hash, iterations } = await hashPassword(tempPassword);
      updateAccount(found.roll, { salt, hash, iterations });
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(() => {
    clearSession();
    setAccount(null);
    refreshAccounts();
  }, [refreshAccounts]);

  const value = useMemo<AuthValue>(
    () => ({
      account,
      accounts,
      booting,
      signUp,
      signIn,
      signOut,
      refreshAccounts,
      hasRecovery,
      setRecoveryCode,
      changePassword,
      resetWithRecoveryCode,
      facultyResetPassword,
    }),
    [
      account,
      accounts,
      booting,
      signUp,
      signIn,
      signOut,
      refreshAccounts,
      hasRecovery,
      setRecoveryCode,
      changePassword,
      resetWithRecoveryCode,
      facultyResetPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
