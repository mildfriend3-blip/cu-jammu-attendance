import { parseCsv, parseAttendanceCsv, normaliseDate, groupByRoll, templateCsv } from "../.tmp/csv.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra); }
};

console.log("\nparseCsv");
{
  const r = parseCsv('a,b,c\r\n1,"x,y",3\r\n4,"he said ""hi""",6\r\n');
  ok("headers", JSON.stringify(r.headers) === '["a","b","c"]', JSON.stringify(r.headers));
  ok("quoted comma kept", r.rows[0][1] === "x,y", r.rows[0][1]);
  ok("escaped quotes", r.rows[1][1] === 'he said "hi"', r.rows[1][1]);
  ok("row count", r.rows.length === 2, String(r.rows.length));
}
{
  const r = parseCsv("roll;date;slot;status\n26BECCS533;2026-10-20;A;P\n");
  ok("semicolon detected", r.headers.length === 4, JSON.stringify(r.headers));
  ok("semicolon note", r.notes.some((n) => n.includes(";")), JSON.stringify(r.notes));
}
{
  const r = parseCsv("\uFEFFroll,date\n26BECCS533,2026-10-20\n\n");
  ok("BOM stripped", r.headers[0] === "roll", r.headers[0]);
  ok("blank line skipped", r.rows.length === 1, String(r.rows.length));
}

console.log("\nnormaliseDate");
ok("ISO passthrough", normaliseDate("2026-10-20") === "2026-10-20");
ok("dd/mm/yyyy", normaliseDate("20/10/2026") === "2026-10-20", normaliseDate("20/10/2026"));
ok("d-m-yyyy", normaliseDate("5-3-2026") === "2026-03-05", normaliseDate("5-3-2026"));
ok("invalid month", normaliseDate("40/13/2026") === null);
ok("impossible day", normaliseDate("31/02/2026") === null);
ok("garbage", normaliseDate("next tuesday") === null);

console.log("\nparseAttendanceCsv");
const rolls = new Set(["26BECCS533", "26BECCS501"]);
{
  const csv = [
    "roll,date,slot,status",
    "26BECCS533,2026-10-20,A,P",       // Tue slot A  -> valid
    "26BECCS533,2026-10-20,B,A",       // Tue slot B  -> valid
    "26BECCS501,20/10/2026,C,present", // dd/mm/yyyy + word status
    "26BECCS999,2026-10-20,A,P",       // unknown roll
    "26BECCS533,2026-10-18,A,P",       // Sunday
    "26BECCS533,2026-10-20,J,P",       // bad slot
    "26BECCS533,2026-10-20,H,P",       // Tue has no slot H
    "26BECCS533,2026-10-20,A,maybe",   // bad status
    "26BECCS533,2026-10-20,A,P",       // duplicate
  ].join("\n");
  const p = parseAttendanceCsv(csv, rolls);
  ok("valid rows", p.rows.length === 3, String(p.rows.length));
  ok("issues found", p.issues.length === 6, String(p.issues.length));
  ok("unknown roll flagged", p.issues.some((i) => i.message.includes("not registered")));
  ok("weekend flagged", p.issues.some((i) => i.message.includes("weekend")));
  ok("bad slot flagged", p.issues.some((i) => i.message.includes('"J"')));
  ok("no-class slot flagged", p.issues.some((i) => i.message.includes("No class in slot H")));
  ok("bad status flagged", p.issues.some((i) => i.message.includes("Unreadable status")));
  ok("duplicate flagged", p.issues.some((i) => i.message.includes("Duplicate")));
  ok("line numbers correct", p.issues[0].line === 5, String(p.issues[0].line));
  ok("word status normalised", p.rows[2].status === "P", p.rows[2].status);
}
{
  const p = parseAttendanceCsv("name,when\nfoo,bar", rolls);
  ok("missing columns reported", p.issues.length === 1 && /Missing required column/.test(p.issues[0].message), JSON.stringify(p.issues));
}
{
  const p = parseAttendanceCsv("roll,date,slot,status\n26BECCS533,2026-10-20,A,P", rolls, new Set(["26BECCS533|2026-10-20|A"]));
  ok("overwrite counted", p.overwrites === 1, String(p.overwrites));
}

console.log("\ngroupByRoll / template");
{
  const p = parseAttendanceCsv("roll,date,slot,status\n26BECCS533,2026-10-20,A,P\n26BECCS533,2026-10-20,B,P\n26BECCS501,2026-10-20,A,A", rolls);
  const g = groupByRoll(p.rows);
  ok("two students", g.size === 2, String(g.size));
  ok("533 has two rows", g.get("26BECCS533").length === 2);
}
ok("template has header", templateCsv().split("\r\n")[0] === "roll,date,slot,status", templateCsv().split("\r\n")[0]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
