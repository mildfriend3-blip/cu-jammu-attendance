/**
 * Account recovery for a no-backend app.
 *
 * There is no server, so there is no way to send mail or verify identity. Three
 * paths are offered instead:
 *
 *   1. a recovery code the student sets themselves (verified locally),
 *   2. a pre-filled mailto: request the student sends from their own mail app,
 *   3. a faculty reset from the console on a shared device.
 *
 * This module holds the pure parts — the mail builder, password-change rules and
 * temporary-password generation — so they can be unit-tested directly.
 */
import { scorePassword } from "./crypto";

export interface ResetMailRequest {
  /** Faculty / department address. Empty opens the mail client with no recipient. */
  to: string;
  app: string;
  department: string;
  roll: string;
  name: string;
  when?: Date;
}

/**
 * Builds a mailto: URL. The app cannot send anything itself — this only opens the
 * student's own mail client with the message pre-filled.
 */
export function buildResetMailto(req: ResetMailRequest): string {
  const when = (req.when ?? new Date()).toLocaleString("en-IN");
  const subject = `Password reset request — ${req.app} (${req.roll})`;
  // Blank details are omitted rather than printed as "(your name)".
  const details = [
    req.name.trim() ? `Name:       ${req.name.trim()}` : null,
    req.roll.trim() ? `Roll:       ${req.roll.trim()}` : null,
    `Requested:  ${when}`,
  ].filter(Boolean);

  const body = [
    `To: ${req.department}`,
    "",
    `I have forgotten the password for my ${req.app} account and would like it reset.`,
    "",
    ...details,
    "",
    "Please reset my password, or send me a recovery code I can use myself.",
    "",
    `— sent from ${req.app}`,
  ].join("\n");

  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${encodeURIComponent(req.to)}?${query}`;
}

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

/** Rules for any new password (sign-up, change, or reset). */
export function validateNewPassword(
  next: string,
  confirm: string,
  roll = "",
  name = "",
): PasswordCheck {
  const strength = scorePassword(next, roll, name);
  if (strength.problems.length > 0) {
    return { ok: false, message: `Password needs ${formatList(strength.problems)}.` };
  }
  if (next !== confirm) return { ok: false, message: "Passwords do not match." };
  return { ok: true };
}

export function formatList(items: string[]): string {
  if (items.length === 0) return "more characters";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Unambiguous alphabet — no 0/O or 1/l/I, since these get read aloud and typed. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const DIGITS = "23456789";
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Readable random secret, e.g. `k7Rm-3QpZ-9tFh`. Used for both the temporary
 * password the faculty console issues and the faculty gate passcode itself.
 * A letter and a digit are placed up front so the result always satisfies the
 * password rules, whatever the random tail happens to be.
 */
export function generateReadableSecret(groups = 3, size = 4): string {
  const total = groups * size;
  const bytes = crypto.getRandomValues(new Uint8Array(total));
  const chars: string[] = [];

  for (let i = 0; i < total; i++) {
    if (i === 0) chars.push(LETTERS[bytes[i] % LETTERS.length]);
    else if (i === 1) chars.push(DIGITS[bytes[i] % DIGITS.length]);
    else chars.push(ALPHABET[bytes[i] % ALPHABET.length]);
  }

  const out: string[] = [];
  for (let g = 0; g < groups; g++) out.push(chars.slice(g * size, (g + 1) * size).join(""));
  return out.join("-");
}

/** Normalises a typed recovery code: case-insensitive, ignore spaces and dashes. */
export function normaliseRecoveryCode(code: string): string {
  return code.trim().replace(/[\s-]+/g, "").toUpperCase();
}

export function isRecoveryCodeAcceptable(code: string): boolean {
  return normaliseRecoveryCode(code).length >= 8;
}
