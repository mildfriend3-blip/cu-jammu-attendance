import {
  isLocked, lockDay, unlockDay, lockedDates, countLocked,
  lockedInRange, latestLock, canEditDay,
} from "../.tmp/locks.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra); }
};

console.log("\nfreeze / reopen");
{
  let l = {};
  ok("nothing locked initially", isLocked(l, "2026-10-21") === false);
  l = lockDay(l, "2026-10-21", "26BECCS533", 1000);
  ok("day is locked", isLocked(l, "2026-10-21") === true);
  ok("records who and when", l["2026-10-21"].by === "26BECCS533" && l["2026-10-21"].lockedAt === 1000);
  ok("other days unaffected", isLocked(l, "2026-10-20") === false);
  l = unlockDay(l, "2026-10-21");
  ok("day reopened", isLocked(l, "2026-10-21") === false);
}
{
  const first = lockDay({}, "2026-10-21", "a", 1000);
  const again = lockDay(first, "2026-10-21", "b", 9999);
  ok("re-locking keeps the original timestamp", again["2026-10-21"].lockedAt === 1000 && again["2026-10-21"].by === "a");
}

console.log("\nimmutability (safe as React state)");
{
  const before = {};
  const after = lockDay(before, "2026-10-21", "x", 1);
  ok("lockDay does not mutate the input", Object.keys(before).length === 0 && Object.keys(after).length === 1);
  const unlocked = unlockDay(after, "2026-10-21");
  ok("unlockDay does not mutate the input", Object.keys(after).length === 1 && Object.keys(unlocked).length === 0);
  ok("unlocking a missing day returns the same object", unlockDay(after, "2099-01-01") === after);
}

console.log("\nwrite guard");
{
  const l = lockDay({}, "2026-10-21", "x", 1);
  ok("locked day blocks edits", canEditDay(l, "2026-10-21") === false);
  ok("unlocked day allows edits", canEditDay(l, "2026-10-20") === true);
  ok("faculty override allows edits", canEditDay(l, "2026-10-21", true) === true);
  ok("override does not unblock other rules", canEditDay({}, "2026-10-21", false) === true);
}

console.log("\nqueries");
{
  let l = {};
  l = lockDay(l, "2026-10-03", "a", 300);
  l = lockDay(l, "2026-10-01", "a", 100);
  l = lockDay(l, "2026-10-02", "a", 200);
  ok("count", countLocked(l) === 3, String(countLocked(l)));
  ok("dates sorted", JSON.stringify(lockedDates(l)) === '["2026-10-01","2026-10-02","2026-10-03"]', JSON.stringify(lockedDates(l)));
  ok("range filter", JSON.stringify(lockedInRange(l, "2026-10-02", "2026-10-03")) === '["2026-10-02","2026-10-03"]');
  const latest = latestLock(l);
  ok("latest by timestamp, not key order", latest.isoDate === "2026-10-03" && latest.lock.lockedAt === 300, JSON.stringify(latest));
  ok("latest is null when empty", latestLock({}) === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
