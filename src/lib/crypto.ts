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
  /** Hard requirements that are NOT met. Empty means the password is acceptable. */
  problems: string[];
  /** Advisory notes. These are shown to the user but never block sign-up. */
  warnings: string[];
}

/**
 * Strength meter.
 *
 * Policy (deliberately NIST SP 800-63B shaped): only two things *block* sign-up —
 * failing the length/character minimums, and matching a known common password.
 * Everything else — no symbol, no uppercase, contains your name — is reported as
 * advice and never rejected, because composition rules push people toward
 * predictable passwords without adding much real entropy.
 */
const COMMON_PASSWORDS = [
  "password", "passw0rd", "pass123", "123456", "12345678", "123456789", "12345",
  "qwerty", "qwertyuiop", "abc123", "letmein", "welcome", "admin", "administrator",
  "iloveyou", "monkey", "dragon", "football", "cricket", "india", "college",
  "student", "sentinel", "changeme", "secret", "master", "sunshine", "princess",
  "superman", "batman", "trustno1", "hello123",
];

const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"] as const;

export function scorePassword(password: string, roll = "", name = ""): PasswordScore {
  const problems: string[] = [];
  const warnings: string[] = [];
  const lower = password.toLowerCase();

  // --- hard requirements -------------------------------------------------
  if (password.length < 8) problems.push("at least 8 characters");
  if (password.length > 0 && !/[A-Za-z]/.test(password)) problems.push("a letter");
  if (password.length > 0 && !/\d/.test(password)) problems.push("a digit");
  if (password.length >= 8 && new Set(password).size === 1) {
    problems.push("more than one repeated character");
  }

  const common = COMMON_PASSWORDS.find((c) => lower.includes(c));
  if (common && password.length >= 8) problems.push(`avoid the common password “${common}”`);

  // --- composition score -------------------------------------------------
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(score, 4);

  // --- advisory penalties: deduct a tier, never force it to the floor -----
  const floor = problems.length ? 0 : 1;
  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

  if (firstName.length > 2 && lower.includes(firstName)) {
    warnings.push("it contains your name");
    score = Math.max(floor, score - 1);
  }
  const rollKey = roll.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (rollKey.length > 2 && lower.replace(/[^a-z0-9]/g, "").includes(rollKey)) {
    warnings.push("it contains your roll number");
    score = Math.max(floor, score - 1);
  }

  if (problems.length === 0 && warnings.length === 0 && score <= 2) {
    warnings.push("a longer password or a symbol would make it stronger");
  }

  return { score: score as PasswordScore["score"], label: LABELS[score], problems, warnings };
}
