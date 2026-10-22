import { useEffect, useMemo, useRef, useState } from "react";
import { SUBJECTS } from "../../data/timetable";
import { computeTotals, logKey, percentage, sessionsOn, subjectHeld } from "../../lib/attendance";
import { rosterCSV, downloadFile, subjectSummaryCSV } from "../../lib/export";
import {
  groupByRoll,
  importReportCsv,
  parseAttendanceCsv,
  templateCsv,
  type ImportPreview,
} from "../../lib/csv";
import { fromISODate, prettyDate, toISODate, weekdayName } from "../../lib/date";
import {
  hasFacultyPasscode,
  loadThrottle,
  loadLocks,
  loadLog,
  loadSettings,
  listAccounts,
  saveLocks,
  saveLog,
  saveThrottle,
  setFacultyPasscode,
  verifyFacultyPasscode,
} from "../../lib/storage";
import { countLocked, isLocked as isDayFrozen, lockedDates } from "../../lib/locks";
import {
  attemptsLeft,
  describeLock,
  isLocked as isGateLocked,
  registerFailure,
  registerSuccess,
  remainingMs,
  type ThrottleState,
} from "../../lib/throttle";
import { generateReadableSecret } from "../../lib/recovery";
import { useAttendance } from "../../state/AttendanceContext";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { Badge, Button, Card, CardBody, CardHead, EmptyState, Field, Input, ProgressBar, Stat } from "../ui";
import { Icon } from "../ui/icons";
import type { Status } from "../../types";

export default function AdminConsole() {
  const { account, facultyResetPassword } = useAuth();
  const { push } = useToast();
  const { settings } = useAttendance();

  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateConfigured, setGateConfigured] = useState(() => hasFacultyPasscode());
  const [throttle, setThrottle] = useState<ThrottleState>(() => loadThrottle());
  const [proposed, setProposed] = useState<string | null>(null);
  const [savedAck, setSavedAck] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [dateStr, setDateStr] = useState(toISODate(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
  const [overrideLocks, setOverrideLocks] = useState(false);
  const [issued, setIssued] = useState<{ roll: string; password: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importName, setImportName] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ rows: number; students: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const roster = useMemo(() => {
    void refreshKey;
    return listAccounts()
      .map((a) => {
        const log = loadLog(a.roll);
        const totals = computeTotals(log);
        const pct = percentage(totals.present, totals.held);
        const target = loadSettings(a.roll).target;
        const locks = loadLocks(a.roll);
        return { account: a, totals, pct, target, locks, lockedCount: countLocked(locks) };
      })
      .sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1));
  }, [refreshKey]);

  const sessions = sessionsOn(dateStr);
  const cohortPct = useMemo(() => {
    let present = 0;
    let held = 0;
    for (const r of roster) {
      present += r.totals.present;
      held += r.totals.held;
    }
    return percentage(present, held);
  }, [roster]);

  const shortCount = roster.filter((r) => r.pct !== null && r.pct < r.target).length;

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const accounts = listAccounts();
      const rolls = new Set(accounts.map((a) => a.roll));
      const existing = new Set<string>();
      for (const a of accounts) {
        for (const key of Object.keys(loadLog(a.roll))) existing.add(`${a.roll}|${key}`);
      }
      const parsed = parseAttendanceCsv(text, rolls, existing);
      setPreview(parsed);
      setImportName(file.name);
      setApplied(null);
      if (parsed.rows.length === 0) push("Nothing importable — check the report below", "error");
    };
    reader.readAsText(file);
  }

  function applyImport() {
    if (!preview || preview.rows.length === 0) return;
    const grouped = groupByRoll(preview.rows);
    for (const [roll, rows] of grouped) {
      const log = { ...loadLog(roll) };
      for (const row of rows) log[logKey(row.iso, row.slot)] = row.status;
      saveLog(roll, log);
    }
    setApplied({ rows: preview.rows.length, students: grouped.size });
    setRefreshKey((k) => k + 1);
    push(`Applied ${preview.rows.length} marks across ${grouped.size} student(s)`, "success");
  }

  // ticks only while the gate is locked, so a countdown stays accurate
  useEffect(() => {
    if (!isGateLocked(throttle, Date.now())) return;
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [throttle]);

  function beginSetup() {
    setProposed(generateReadableSecret(4, 4));
    setSavedAck(false);
  }

  async function confirmSetup() {
    if (!proposed || !savedAck) return;
    setGateBusy(true);
    try {
      await setFacultyPasscode(proposed);
      const fresh = registerSuccess();
      setThrottle(fresh);
      saveThrottle(fresh);
      setGateConfigured(true);
      setUnlocked(true);
      setProposed(null);
      push("Faculty passcode set", "success");
    } finally {
      setGateBusy(false);
    }
  }

  async function unlock() {
    if (isGateLocked(throttle, Date.now())) return;
    setGateBusy(true);
    try {
      if (await verifyFacultyPasscode(code)) {
        const fresh = registerSuccess();
        setThrottle(fresh);
        saveThrottle(fresh);
        setUnlocked(true);
        setCode("");
        setCodeError(null);
        push("Faculty console unlocked", "success");
      } else {
        const next = registerFailure(throttle, Date.now());
        setThrottle(next);
        saveThrottle(next);
        setCode("");
        setCodeError(
          isGateLocked(next, Date.now())
            ? describeLock(remainingMs(next, Date.now()))
            : `Incorrect passcode. ${attemptsLeft(next)} attempt${attemptsLeft(next) === 1 ? "" : "s"} left before a lockout.`,
        );
      }
    } finally {
      setGateBusy(false);
    }
  }

  function bulkMark(status: Status) {
    if (!sessions.length) return;
    let touched = 0;
    let skipped = 0;
    for (const a of listAccounts()) {
      const locks = loadLocks(a.roll);
      if (isDayFrozen(locks, dateStr) && !overrideLocks) {
        skipped++;
        continue;
      }
      const log = { ...loadLog(a.roll) };
      for (const s of sessions) log[logKey(dateStr, s.slot)] = status;
      saveLog(a.roll, log);
      touched++;
    }
    setRefreshKey((k) => k + 1);
    push(
      `Marked ${status} for ${touched} account${touched === 1 ? "" : "s"}` +
        (skipped ? ` · skipped ${skipped} locked (enable override to force)` : ""),
      skipped && !touched ? "warn" : "success",
    );
  }

  async function resetStudentPassword(roll: string, name: string) {
    if (
      !window.confirm(
        `Issue a new temporary password for ${name} (${roll})?\n\nTheir current password stops working immediately.`,
      )
    ) {
      return;
    }
    const temp = generateReadableSecret();
    const result = await facultyResetPassword(roll, temp);
    if (!result.ok) {
      push(result.message ?? "Could not reset the password", "error");
      return;
    }
    setIssued({ roll, password: temp });
    push(`Temporary password issued for ${roll}`, "success");
  }

  function unlockStudent(roll: string) {
    const locks = loadLocks(roll);
    const n = countLocked(locks);
    if (!n) {
      push(`${roll} has no locked days`);
      return;
    }
    if (!window.confirm(`Reopen ${n} locked day${n === 1 ? "" : "s"} for ${roll}?`)) return;
    saveLocks(roll, {});
    setRefreshKey((k) => k + 1);
    push(`Reopened ${n} day${n === 1 ? "" : "s"} for ${roll}`, "success");
  }

  if (!unlocked) {
    const locked = isGateLocked(throttle, clock);
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Faculty console</h1>
            <div className="sub">Class-wide attendance tools. Requires the faculty passcode.</div>
          </div>
        </div>

        <Card style={{ maxWidth: 520 }}>
          {!gateConfigured && (
            <>
              <CardHead title="Set up the faculty passcode" sub="No passcode is configured on this device yet." />
              <CardBody>
                {!proposed ? (
                  <>
                    <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16 }}>
                      The console can rewrite any student&apos;s attendance and reset their password, so it is locked
                      behind a passcode. There is no default — generate one now.
                    </p>
                    <Button variant="solid" block icon="key" onClick={beginSetup}>
                      Generate a passcode
                    </Button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12 }}>
                      Write this down now. It is shown once, stored only as a hash, and cannot be recovered.
                    </p>
                    <div
                      className="mono"
                      style={{
                        fontSize: 20,
                        letterSpacing: ".08em",
                        padding: "14px 16px",
                        border: "1px solid var(--line-accent)",
                        borderRadius: "var(--r-sm)",
                        background: "var(--surface-2)",
                        textAlign: "center",
                        userSelect: "all",
                      }}
                    >
                      {proposed}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <Button
                        size="sm"
                        icon="download"
                        onClick={() => {
                          void navigator.clipboard?.writeText(proposed);
                          push("Copied");
                        }}
                      >
                        Copy
                      </Button>
                      <Button size="sm" variant="ghost" icon="refresh" onClick={beginSetup}>
                        Regenerate
                      </Button>
                    </div>

                    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, marginTop: 18, cursor: "pointer" }}>
                      <input type="checkbox" checked={savedAck} onChange={(e) => setSavedAck(e.target.checked)} />
                      <span>I have saved this passcode somewhere outside this browser.</span>
                    </label>

                    <Button
                      variant="solid"
                      block
                      style={{ marginTop: 14 }}
                      icon="check"
                      disabled={!savedAck || gateBusy}
                      onClick={() => void confirmSetup()}
                    >
                      {gateBusy ? "Saving…" : "Set passcode and unlock"}
                    </Button>
                  </>
                )}
              </CardBody>
            </>
          )}

          {gateConfigured && (
            <>
              <CardHead
                title="Unlock the console"
                sub={locked ? undefined : "Enter the faculty passcode."}
              />
              <CardBody>
                {locked ? (
                  <div
                    style={{
                      border: "1px solid var(--line)",
                      borderLeft: "3px solid var(--warn)",
                      borderRadius: "var(--r-sm)",
                      background: "var(--warn-dim)",
                      color: "var(--warn)",
                      padding: "12px 14px",
                      fontSize: 13,
                    }}
                  >
                    {describeLock(remainingMs(throttle, clock))}
                  </div>
                ) : (
                  <>
                    <Field label="Faculty passcode" htmlFor="fcode" error={codeError ?? undefined}>
                      <div className="pw-wrap">
                        <Input
                          id="fcode"
                          type="password"
                          className="mono"
                          value={code}
                          autoComplete="off"
                          invalid={Boolean(codeError)}
                          onChange={(e) => setCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void unlock();
                          }}
                          placeholder="••••••••"
                        />
                      </div>
                    </Field>
                    <Button
                      variant="solid"
                      block
                      style={{ marginTop: 16 }}
                      icon="key"
                      disabled={gateBusy || !code}
                      onClick={() => void unlock()}
                    >
                      {gateBusy ? "Checking…" : "Unlock console"}
                    </Button>
                  </>
                )}

                <div className="hint" style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  The passcode is stored only as a salted PBKDF2 hash, and repeated wrong attempts are throttled.
                  Because this is a client-side app, someone with full control of the browser can still bypass it —
                  treat it as a speed bump, not a wall.
                </div>
              </CardBody>
            </>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Faculty console</h1>
          <div className="sub">
            {roster.length} account{roster.length === 1 ? "" : "s"} on this device · signed in as {account?.name}
          </div>
        </div>
        <div className="actions">
          <Button
            icon="download"
            onClick={() => {
              downloadFile(
                `cujatt-roster-${toISODate(new Date())}.csv`,
                rosterCSV(
                  roster.map((r) => ({
                    roll: r.account.roll,
                    name: r.account.name,
                    present: r.totals.present,
                    held: r.totals.held,
                    pct: r.pct,
                    target: r.target,
                  })),
                ),
                "text/csv;charset=utf-8",
              );
              push("Roster exported", "success");
            }}
          >
            Export roster
          </Button>
          <Button variant="ghost" icon="lock" onClick={() => setUnlocked(false)}>
            Lock
          </Button>
        </div>
      </div>

      <div className="grid c4" style={{ marginBottom: 14 }}>
        <Stat label="Accounts" value={roster.length} icon="users" />
        <Stat label="Cohort rate" value={cohortPct === null ? "—" : cohortPct.toFixed(1)} unit="%" icon="target" accent />
        <Stat label="Below target" value={shortCount} icon="alert" />
        <Stat label="Subjects" value={Object.keys(SUBJECTS).length} icon="book" />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <CardHead title="Bulk marking" sub="Writes the same status to every account for the chosen date" />
        <CardBody>
          <div className="toolbar">
            <input
              type="date"
              className="input mono"
              style={{ maxWidth: 190 }}
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
            <Badge tone={sessions.length ? "info" : "neutral"}>
              {sessions.length} session{sessions.length === 1 ? "" : "s"} on {weekdayName(fromISODate(dateStr))}
            </Badge>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button size="sm" icon="check" disabled={!sessions.length} onClick={() => bulkMark("P")}>
                All present
              </Button>
              <Button size="sm" variant="danger" icon="close" disabled={!sessions.length} onClick={() => bulkMark("A")}>
                All absent
              </Button>
              <Button size="sm" variant="ghost" icon="alert" disabled={!sessions.length} onClick={() => bulkMark("C")}>
                All cancelled
              </Button>
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, marginTop: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={overrideLocks} onChange={(e) => setOverrideLocks(e.target.checked)} />
            <span>
              Override locks — by default, days a student has already submitted are skipped rather than overwritten.
            </span>
          </label>
          <div className="hint" style={{ marginTop: 10 }}>
            {prettyDate(fromISODate(dateStr))} — this overwrites existing marks for those slots on every account that
            is not locked.
          </div>
        </CardBody>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <CardHead
          title="Import attendance (CSV)"
          sub="Bulk-load marks taken on paper or in a spreadsheet — one row per class"
          actions={
            <>
              <Button
                size="sm"
                icon="download"
                onClick={() => {
                  downloadFile("cujatt-import-template.csv", templateCsv(), "text/csv;charset=utf-8");
                  push("Template downloaded");
                }}
              >
                Template
              </Button>
              <Button size="sm" variant="outline" icon="upload" onClick={() => importRef.current?.click()}>
                Choose file
              </Button>
            </>
          }
        />
        <CardBody>
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />

          {!preview && (
            <>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10 }}>
                Expected columns — header row required, order does not matter:
              </div>
              <pre
                className="mono"
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  background: "var(--bg-elev)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-sm)",
                  fontSize: 12,
                  overflowX: "auto",
                }}
              >{`roll,date,slot,status
26BECCS533,2026-10-20,A,P
26BECCS533,2026-10-20,B,A
26BECCS501,20/10/2026,C,present`}</pre>
              <div className="hint" style={{ marginTop: 10 }}>
                <b>slot</b> is A–I. <b>status</b> accepts P/A/C or present/absent/cancelled. Dates accept
                YYYY-MM-DD or DD/MM/YYYY. Comma, semicolon and tab separated files all work. Every row is validated
                before anything is written, so a bad line never half-imports.
              </div>
            </>
          )}

          {preview && (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                <Badge tone="info">{importName}</Badge>
                <Badge tone={preview.rows.length ? "ok" : "bad"}>{preview.rows.length} valid row(s)</Badge>
                {preview.issues.length > 0 && <Badge tone="warn">{preview.issues.length} skipped</Badge>}
                {preview.overwrites > 0 && <Badge tone="warn">{preview.overwrites} will overwrite</Badge>}
                {applied && <Badge tone="ok">applied · {applied.rows} rows / {applied.students} students</Badge>}
              </div>

              {preview.notes.map((n) => (
                <div key={n} className="hint" style={{ marginBottom: 8 }}>
                  <Icon name="info" size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  {n}
                </div>
              ))}

              {preview.issues.length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--line)",
                    borderLeft: "3px solid var(--warn)",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-2)",
                    padding: "10px 12px",
                    marginBottom: 12,
                    maxHeight: 190,
                    overflowY: "auto",
                  }}
                >
                  {preview.issues.slice(0, 40).map((issue, i) => (
                    <div key={`${issue.line}-${i}`} className="mono" style={{ fontSize: 11.5, lineHeight: 1.8 }}>
                      <span style={{ color: "var(--warn)" }}>line {issue.line}</span>{" "}
                      <span style={{ color: "var(--ink-2)" }}>{issue.message}</span>
                    </div>
                  ))}
                  {preview.issues.length > 40 && (
                    <div className="hint">…and {preview.issues.length - 40} more (see the report).</div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  variant="solid"
                  icon="check"
                  disabled={preview.rows.length === 0 || Boolean(applied)}
                  onClick={applyImport}
                >
                  {applied ? "Applied" : `Apply ${preview.rows.length} row(s)`}
                </Button>
                <Button
                  icon="download"
                  onClick={() =>
                    downloadFile("cujatt-import-report.csv", importReportCsv(preview.rows, preview.issues), "text/csv;charset=utf-8")
                  }
                >
                  Download report
                </Button>
                <Button
                  variant="ghost"
                  icon="refresh"
                  onClick={() => {
                    setPreview(null);
                    setImportName(null);
                    setApplied(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Roster" sub="Sorted by attendance rate, lowest first" />
        {roster.length === 0 ? (
          <CardBody>
            <EmptyState icon="users" title="No accounts yet" body="Students appear here once they register on this device." />
          </CardBody>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll</th>
                  <th>Type</th>
                  <th style={{ minWidth: 150 }}>Rate</th>
                  <th className="num">Present</th>
                  <th className="num">Held</th>
                  <th>Status</th>
                  <th className="num">Locked</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => {
                  const risk = r.pct === null ? "none" : r.pct >= r.target ? "ok" : r.pct >= r.target - 10 ? "warn" : "bad";
                  return (
                    <tr key={r.account.roll}>
                      <td>{r.account.name}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{r.account.roll}</td>
                      <td>
                        <Badge tone={r.account.role === "faculty" ? "info" : "neutral"}>{r.account.role}</Badge>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <ProgressBar
                              value={r.pct ?? 0}
                              color={risk === "ok" ? "var(--accent)" : risk === "warn" ? "var(--warn)" : risk === "bad" ? "var(--danger)" : "var(--ink-3)"}
                            />
                          </div>
                          <span className="mono tnum" style={{ fontSize: 12, width: 48, textAlign: "right" }}>
                            {r.pct === null ? "—" : `${r.pct.toFixed(1)}%`}
                          </span>
                        </div>
                      </td>
                      <td className="num">{r.totals.present}</td>
                      <td className="num">{r.totals.held}</td>
                      <td>
                        <Badge tone={risk === "ok" ? "ok" : risk === "warn" ? "warn" : risk === "bad" ? "bad" : "neutral"}>
                          {r.pct === null ? "no data" : r.pct >= r.target ? "OK" : "SHORT"}
                        </Badge>
                      </td>
                      <td className="num">
                        {r.lockedCount ? (
                          <span title={lockedDates(r.locks).join(", ")}>
                            <Badge tone="warn">
                              <Icon name="lock" size={10} /> {r.lockedCount}
                            </Badge>
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-3)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="key"
                            disabled={!r.lockedCount}
                            title={r.lockedCount ? "Reopen this student's locked days" : "No locked days"}
                            onClick={() => unlockStudent(r.account.roll)}
                          >
                            Unlock
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="key"
                            title="Issue a temporary password"
                            onClick={() => void resetStudentPassword(r.account.roll, r.account.name)}
                          >
                            Reset
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="download"
                          onClick={() => {
                            const log = loadLog(r.account.roll);
                            downloadFile(
                              `cujatt-${r.account.roll}.csv`,
                              subjectSummaryCSV(r.account.roll, r.account.name, log, r.target),
                              "text/csv;charset=utf-8",
                            );
                            push(`Exported ${r.account.roll}`);
                          }}
                          >
                            CSV
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {issued && (
        <Card style={{ marginTop: 14 }}>
          <CardBody style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Icon name="key" size={20} style={{ color: "var(--warn)" }} />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontWeight: 600 }}>Temporary password for {issued.roll}</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
                Read this to the student now — it is shown once and cannot be looked up again.
              </div>
              <div
                className="mono"
                style={{
                  marginTop: 10,
                  fontSize: 17,
                  letterSpacing: ".06em",
                  padding: "9px 13px",
                  border: "1px solid var(--line-accent)",
                  borderRadius: "var(--r-sm)",
                  background: "var(--surface-2)",
                  display: "inline-block",
                }}
              >
                {issued.password}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                size="sm"
                icon="download"
                onClick={() => {
                  void navigator.clipboard?.writeText(issued.password);
                  push("Copied");
                }}
              >
                Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>
                Dismiss
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card style={{ marginTop: 14 }}>
        <CardHead title="Cohort by subject" sub={`Target default ${settings.target}%`} />
        <CardBody>
          {Object.values(SUBJECTS).map((s) => {
            let present = 0;
            let held = 0;
            for (const r of roster) {
              const tally = r.totals.per[s.code];
              present += tally?.present ?? 0;
              held += subjectHeld(tally);
            }
            const p = percentage(present, held);
            return (
              <div key={s.code} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <span className="mono" style={{ width: 78, fontSize: 11, color: `var(${s.hue})` }}>
                  {s.code}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>{s.short}</span>
                <div style={{ width: 140, flex: "none" }}>
                  <ProgressBar value={p ?? 0} color={p !== null && p >= settings.target ? "var(--accent)" : "var(--danger)"} />
                </div>
                <span className="mono tnum" style={{ width: 52, textAlign: "right", fontSize: 12.5 }}>
                  {p === null ? "—" : `${p.toFixed(1)}%`}
                </span>
              </div>
            );
          })}
        </CardBody>
      </Card>
    </>
  );
}
