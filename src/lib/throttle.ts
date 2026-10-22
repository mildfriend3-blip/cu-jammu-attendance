/**
 * Failed-attempt throttling for the faculty gate.
 *
 * Purely local, so a determined attacker can clear the counter from devtools.
 * It still matters: it turns an unlimited online guess into a slow one, and it
 * is what stops the realistic threat here — someone repeatedly tapping a guess
 * on a shared lab machine.
 *
 * Pure and clock-injected so the schedule can be tested without waiting.
 */

export interface ThrottleState {
  failures: number;
  /** epoch ms until which attempts are refused; 0 means open */
  lockedUntil: number;
}

export const MAX_FREE_ATTEMPTS = 5;

/** Delay applied after the Nth consecutive failure (index = failures). */
const LOCK_SCHEDULE_MS = [0, 0, 0, 0, 0, 30_000, 60_000, 120_000, 300_000, 900_000];

export function emptyThrottle(): ThrottleState {
  return { failures: 0, lockedUntil: 0 };
}

export function lockDurationFor(failures: number): number {
  if (failures < MAX_FREE_ATTEMPTS) return 0;
  const index = Math.min(failures, LOCK_SCHEDULE_MS.length - 1);
  return LOCK_SCHEDULE_MS[index] ?? 900_000;
}

export function registerFailure(state: ThrottleState, now: number): ThrottleState {
  const failures = state.failures + 1;
  const lock = lockDurationFor(failures);
  return { failures, lockedUntil: lock ? now + lock : 0 };
}

export function registerSuccess(): ThrottleState {
  return emptyThrottle();
}

export function isLocked(state: ThrottleState, now: number): boolean {
  return state.lockedUntil > now;
}

export function remainingMs(state: ThrottleState, now: number): number {
  return Math.max(0, state.lockedUntil - now);
}

export function describeLock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  return `Too many attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
}

export function attemptsLeft(state: ThrottleState): number {
  return Math.max(0, MAX_FREE_ATTEMPTS - state.failures);
}
