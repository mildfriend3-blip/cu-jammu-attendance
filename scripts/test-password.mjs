import { scorePassword } from "../.tmp/crypto.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra); }
};

console.log("\nreported bug: Neha@1008");
{
  const s = scorePassword("Neha@1008", "", "Neha Bhavsar");
  ok("not blocked (no problems)", s.problems.length === 0, JSON.stringify(s.problems));
  ok("name match is a warning only", s.warnings.some((w) => /your name/.test(w)), JSON.stringify(s.warnings));
  ok("scored Fair, not Weak", s.label === "Fair", s.label);
  ok("score is 2", s.score === 2, String(s.score));
}
{
  const s = scorePassword("Neha@1008", "", "Lokesh Bhavsar");
  ok("accepted with an unrelated name", s.problems.length === 0);
  ok("no warning when name differs", s.warnings.length === 0, JSON.stringify(s.warnings));
  ok("scored Good", s.label === "Good", s.label);
}
{
  const s = scorePassword("Neha@1008");
  ok("no roll/name passed -> no warnings", s.warnings.length === 0, JSON.stringify(s.warnings));
}

console.log("\nno false rejections, and never an empty reason list");
// Every one of these is a perfectly reasonable password; all must be accepted.
// The original bug rejected the first two with "add ." (empty reason list).
for (const [pw, roll, name] of [
  ["Neha@1008", "", "Neha Bhavsar"],
  ["Neha@1008", "26BECCS533", "Neha"],
  ["Lokesh@1234", "26BECCS533", "Lokesh Bhavsar"],
]) {
  const s = scorePassword(pw, roll, name);
  ok(`"${pw}" is accepted`, s.problems.length === 0, JSON.stringify(s.problems));
}
// And whenever something IS rejected, the reason list must be non-empty,
// otherwise the UI renders "Password needs ." with nothing after it.
// "Sentinel@2026" is blocked on purpose: the product name is on the blocklist.
for (const pw of ["abc", "", "abcdefgh", "12345678", "password123", "aaaaaaaa", "Sentinel@2026"]) {
  const s = scorePassword(pw, "26BECCS533", "Lokesh Bhavsar");
  ok(`"${pw}" rejected with a stated reason`, s.problems.length > 0, JSON.stringify(s.problems));
}

console.log("\nhard requirements");
{
  const s = scorePassword("abc");
  ok("short + no digit", s.problems.includes("at least 8 characters") && s.problems.includes("a digit"), JSON.stringify(s.problems));
}
{
  const s = scorePassword("abcdefgh");
  ok("8 letters, no digit", s.problems.length === 1 && s.problems[0] === "a digit", JSON.stringify(s.problems));
  ok("scored Weak", s.label === "Weak", s.label);
}
{
  const s = scorePassword("");
  ok("empty -> only the length problem", s.problems.length === 1 && s.problems[0] === "at least 8 characters", JSON.stringify(s.problems));
}
{
  const s = scorePassword("aaaaaaaa");
  ok("single repeated char flagged", s.problems.some((p) => /repeated/.test(p)), JSON.stringify(s.problems));
}
{
  const s = scorePassword("password123");
  ok("common password blocked", s.problems.some((p) => /common password/.test(p)), JSON.stringify(s.problems));
}
{
  const s = scorePassword("12345678");
  ok("digit-only + common blocked", s.problems.some((p) => /a letter/.test(p)) && s.problems.some((p) => /common/.test(p)), JSON.stringify(s.problems));
}

console.log("\nroll number warning");
{
  const s = scorePassword("X26beccs533!", "26BECCS533", "Lokesh");
  ok("roll detected through punctuation", s.warnings.some((w) => /roll number/.test(w)), JSON.stringify(s.warnings));
  ok("still accepted", s.problems.length === 0);
}

console.log("\nstrong password");
{
  const s = scorePassword("Str0ng#Pass!2026", "", "Lokesh Bhavsar");
  ok("no problems", s.problems.length === 0);
  ok("no warnings", s.warnings.length === 0, JSON.stringify(s.warnings));
  ok("scored Strong", s.label === "Strong", s.label);
  ok("score 4", s.score === 4, String(s.score));
}

console.log("\nlabels line up with scores");
{
  const cases = [
    ["abc", "Very weak"],
    ["abcdefgh", "Weak"],
    ["Neha@1008", "Fair"],           // no name passed -> 3, so check below instead
  ];
  void cases;
  ok("0 -> Very weak", scorePassword("a").label === "Very weak");
  ok("1 -> Weak", scorePassword("abcdefgh").label === "Weak");
  ok("2 -> Fair", scorePassword("Abcdefg1").label === "Fair", scorePassword("Abcdefg1").label);
  ok("3 -> Good", scorePassword("Neha@1008").label === "Good", scorePassword("Neha@1008").label);
  ok("4 -> Strong", scorePassword("Str0ng#Pass!2026").label === "Strong");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
