import {
  buildResetMailto, validateNewPassword, generateTemporaryPassword,
  normaliseRecoveryCode, isRecoveryCodeAcceptable,
} from "../.tmp/recovery.mjs";
import { scorePassword } from "../.tmp/crypto.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra); }
};

console.log("\nmailto builder");
{
  const url = buildResetMailto({
    to: "faculty@example.edu",
    app: "CUJ Attendance",
    department: "Department of CSE & CSIT",
    roll: "26BECCS533",
    name: "Lokesh Bhavsar",
    when: new Date("2026-10-22T09:30:00Z"),
  });
  ok("is a mailto URL", url.startsWith("mailto:"), url.slice(0, 20));
  ok("recipient encoded", url.startsWith("mailto:faculty%40example.edu?"), url.slice(0, 40));
  ok("has a subject", /[?&]subject=/.test(url));
  ok("has a body", /[?&]body=/.test(url));
  ok("roll appears in the body", decodeURIComponent(url).includes("26BECCS533"));
  ok("name appears in the body", decodeURIComponent(url).includes("Lokesh Bhavsar"));
  ok("department appears in the body", decodeURIComponent(url).includes("Department of CSE & CSIT"));
  ok("spaces are percent-encoded, not +", !url.includes("+"));
  ok("newlines survive decoding", decodeURIComponent(url).includes("\n"));
  ok("no raw spaces", !/\s/.test(url));
}
{
  const url = buildResetMailto({ to: "", app: "App", department: "D", roll: "R", name: "N" });
  ok("empty recipient still yields a valid mailto", url.startsWith("mailto:?"), url.slice(0, 24));
}

console.log("\nrecovery code normalisation");
ok("lower case accepted", normaliseRecoveryCode("k7rm3qpz") === "K7RM3QPZ");
ok("dashes and spaces ignored", normaliseRecoveryCode(" k7rm-3qpz 9tfh ") === "K7RM3QPZ9TFH");
ok("short code rejected", isRecoveryCodeAcceptable("abc") === false);
ok("8 chars accepted", isRecoveryCodeAcceptable("k7rm3qpz") === true);
ok("8 chars with dashes accepted", isRecoveryCodeAcceptable("k7rm-3qpz") === true);

console.log("\nnew-password rules");
{
  ok("mismatch rejected", validateNewPassword("Str0ng#Pass", "other", "R", "N").ok === false);
  ok("weak rejected", validateNewPassword("abcdefgh", "abcdefgh", "R", "N").ok === false);
  ok("strong accepted", validateNewPassword("Str0ng#Pass!2026", "Str0ng#Pass!2026", "R", "N").ok === true);
  const msg = validateNewPassword("abcdefgh", "abcdefgh", "R", "N").message;
  ok("rejection names a reason", /needs .+/.test(msg), msg);
}

console.log("\ntemporary password");
{
  const a = generateTemporaryPassword();
  const b = generateTemporaryPassword();
  ok("three groups", a.split("-").length === 3, a);
  ok("grouped in fours", a.split("-").every((g) => g.length === 4), a);
  ok("contains a letter", /[A-Za-z]/.test(a));
  ok("contains a digit", /\d/.test(a));
  ok("avoids ambiguous characters", !/[0O1lI]/.test(a), a);
  ok("random between calls", a !== b, `${a} / ${b}`);

  // the whole point: a generated password must actually be usable
  let allValid = true;
  for (let i = 0; i < 200; i++) {
    const p = generateTemporaryPassword();
    if (!validateNewPassword(p, p, "26BECCS533", "Lokesh Bhavsar").ok) { allValid = false; console.log("     bad:", p); break; }
  }
  ok("200 generated passwords all pass the rules", allValid);
  ok("generated password scores well", scorePassword(a).score >= 3, String(scorePassword(a).score));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
