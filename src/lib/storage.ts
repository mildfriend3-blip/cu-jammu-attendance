import type { StudentRecord } from "../types";

const PREFIX = "cuj_att::";

const keyFor = (roll: string) => PREFIX + roll.trim().toUpperCase();

export function normaliseRoll(roll: string): string {
  return roll.trim().toUpperCase();
}

export function loadRecord(roll: string): StudentRecord | null {
  try {
    const raw = localStorage.getItem(keyFor(roll));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudentRecord;
    if (!parsed || typeof parsed.roll !== "string" || typeof parsed.log !== "object") {
      return null;
    }
    if (typeof parsed.target !== "number") parsed.target = 75;
    if (typeof parsed.name !== "string") parsed.name = "Unnamed";
    return parsed;
  } catch {
    return null;
  }
}

export function saveRecord(record: StudentRecord): void {
  record.updatedAt = Date.now();
  localStorage.setItem(keyFor(record.roll), JSON.stringify(record));
}

export function listRecords(): StudentRecord[] {
  const out: StudentRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "") as StudentRecord;
      if (parsed?.roll) out.push(parsed);
    } catch {
      /* skip corrupt entries */
    }
  }
  return out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function deleteRecord(roll: string): void {
  localStorage.removeItem(keyFor(roll));
}
