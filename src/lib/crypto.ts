/**
 * Password hashing for the local account store.
 *
 * PBKDF2-HMAC-SHA256 via Web Crypto, with a per-account random salt.
 * This is real key derivation (not a toy hash), but note the honest caveat:
 * the verifier lives in localStorage, so anyone with the device and devtools
 * can read or replace it. It protects against casual snooping, not a
 * determined local attacker. Real enforcement needs a server.
 */
const ITERATIONS = 210_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

const enc = new TextEncoder();

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto unavailable — open the app over HTTPS or localhost.");
  }
  return globalThis.crypto.subtle;
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (const b of view) out += String.fromCharCode(b);
  return btoa(out);
}

function fromBase64(b64: string): Uint8Array {
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
  return toBase64(bits);
}

export interface PasswordRecord {
  salt: string;
  hash: string;
  iterations: number;
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return { salt: toBase64(salt), hash, iterations: ITERATIONS };
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  const hash = await derive(password, fromBase64(record.salt), record.iterations);
  return timingSafeEqual(hash, record.hash);
}

/** Length-independent, constant-time-ish string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function randomToken(bytes = 24): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/[^A-Za-z0-9]/g, "");
}

export interface PasswordScore {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  problems: string[];
}

/** Lightweight strength meter — feedback only, not a policy gate. */
export function scorePassword(password: string, roll = "", name = ""): PasswordScore {
  const problems: string[] = [];
  if (password.length < 8) problems.push("at least 8 characters");
  if (!/[a-z]/.test(password)) problems.push("a lowercase letter");
  if (!/[A-Z]/.test(password)) problems.push("an uppercase letter");
  if (!/\d/.test(password)) problems.push("a digit");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("a symbol");

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const lowered = password.toLowerCase();
  const banned = ["password", "123456", "qwerty", "admin", "college", "sentinel"];
  if (banned.some((b) => lowered.includes(b))) score = Math.min(score, 1) as PasswordScore["score"];
  if (roll && lowered.includes(roll.toLowerCase())) score = Math.min(score, 1) as PasswordScore["score"];
  if (name && name.length > 3 && lowered.includes(name.toLowerCase().split(" ")[0])) {
    score = Math.min(score, 1) as PasswordScore["score"];
  }

  const labels = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];
  return { score: score as PasswordScore["score"], label: labels[score], problems };
}
