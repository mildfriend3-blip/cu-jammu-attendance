/**
 * Day locks — once a student submits a day, its marks are frozen.
 *
 * This is the anti-tampering rule: attendance you have already reported cannot be
 * quietly edited afterwards. Reopening a day requires the faculty passcode.
 *
 * All helpers are pure and return new objects, so they are safe to use directly
 * as React state updates and can be unit-tested without a DOM or localStorage.
 */

export interface DayLock {
  /** epoch ms when the day was frozen */
  lockedAt: number;
  /** roll number of whoever froze it */
  by: string;
}

export type Locks = Record<string, DayLock>;

export function isLocked(locks: Locks, isoDate: string): boolean {
  return Boolean(locks[isoDate]);
}

/** Freeze a day. Re-locking an already locked day keeps the original timestamp. */
export function lockDay(locks: Locks, isoDate: string, by: string, at: number = Date.now()): Locks {
  if (locks[isoDate]) return locks;
  return { ...locks, [isoDate]: { lockedAt: at, by } };
}

/** Reopen a day. No-op when it was not locked. */
export function unlockDay(locks: Locks, isoDate: string): Locks {
  if (!locks[isoDate]) return locks;
  const next = { ...locks };
  delete next[isoDate];
  return next;
}

export function lockedDates(locks: Locks): string[] {
  return Object.keys(locks).sort();
}

export function countLocked(locks: Locks): number {
  return Object.keys(locks).length;
}


/**
 * Whether a write to `isoDate` should be allowed.
 * `override` is what the faculty console passes after a successful passcode check.
 */
export function canEditDay(locks: Locks, isoDate: string, override = false): boolean {
  return override || !isLocked(locks, isoDate);
}
