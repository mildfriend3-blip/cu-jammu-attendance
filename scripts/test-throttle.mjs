import {
  MAX_FREE_ATTEMPTS, emptyThrottle, lockDurationFor, registerFailure, registerSuccess,
  isLocked, remainingMs, describeLock, attemptsLeft,
} from "../.tmp/throttle.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra); }
};

const T0 = 1_000_000_000_000; // fixed clock, so nothing here depends on wall time

console.log("\nlock schedule");
ok("first four failures lock nothing", [1, 2, 3, 4].every((n) => lockDurationFor(n) === 0));
ok("5th failure locks 30s", lockDurationFor(5) === 30_000, String(lockDurationFor(5)));
ok("6th escalates to 60s", lockDurationFor(6) === 60_000, String(lockDurationFor(6)));
ok("8th escalates to 300s", lockDurationFor(8) === 300_000, String(lockDurationFor(8)));
ok("very high count is capped at 900s", lockDurationFor(50) === 900_000, String(lockDurationFor(50)));
ok("schedule is non-decreasing", Array.from({ length: 12 }, (_, i) => lockDurationFor(i + 1))
  .every((v, i, a) => i === 0 || v >= a[i - 1]));

console.log("\nfailure sequence");
{
  let state = emptyThrottle();
  ok("starts unlocked", isLocked(state, T0) === false);
  ok("starts with 5 attempts left", attemptsLeft(state) === MAX_FREE_ATTEMPTS);

  for (let i = 0; i < 4; i++) state = registerFailure(state, T0);
  ok("still open after 4 failures", isLocked(state, T0) === false, String(state.failures));
  ok("1 attempt left", attemptsLeft(state) === 1, String(attemptsLeft(state)));

  state = registerFailure(state, T0);
  ok("locked on the 5th failure", isLocked(state, T0) === true);
  ok("lock expires in 30s", remainingMs(state, T0) === 30_000, String(remainingMs(state, T0)));
  ok("still locked 29s later", isLocked(state, T0 + 29_000) === true);
  ok("unlocked after 31s", isLocked(state, T0 + 31_000) === false);

  state = registerFailure(state, T0 + 31_000);
  ok("6th failure locks 60s", remainingMs(state, T0 + 31_000) === 60_000, String(remainingMs(state, T0 + 31_000)));
}

console.log("\nreset on success");
{
  let state = emptyThrottle();
  state = registerFailure(state, T0);
  state = registerFailure(state, T0);
  ok("failures accumulated", state.failures === 2);
  state = registerSuccess();
  ok("cleared after a correct passcode", state.failures === 0 && state.lockedUntil === 0);
  ok("attempts restored", attemptsLeft(state) === MAX_FREE_ATTEMPTS);
}

console.log("\nremaining time never goes negative");
{
  const state = { failures: 5, lockedUntil: T0 + 30_000 };
  ok("zero once past the lock", remainingMs(state, T0 + 60_000) === 0, String(remainingMs(state, T0 + 60_000)));
  ok("not locked once past the lock", isLocked(state, T0 + 60_000) === false);
}

console.log("\ncopy");
ok("seconds wording", describeLock(45_000) === "Too many attempts. Try again in 45 seconds.", describeLock(45_000));
ok("singular second", describeLock(1_000) === "Too many attempts. Try again in 1 second.", describeLock(1_000));
ok("minutes wording", describeLock(120_000) === "Too many attempts. Try again in 2 minutes.", describeLock(120_000));
ok("rounds up to a minute", describeLock(61_000) === "Too many attempts. Try again in 2 minutes.", describeLock(61_000));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
