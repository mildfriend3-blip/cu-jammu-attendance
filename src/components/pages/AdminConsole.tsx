import { useMemo, useRef, useState } from "react";
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
import { loadFacultyPasscode, loadLog, loadSettings, listAccounts, saveLog } from "../../lib/storage";
import { useAttendance } from "../../state/AttendanceContext";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { Badge, Button, Card, CardBody, CardHead, EmptyState, Field, Input, ProgressBar, Stat } from "../ui";
import { Icon } from "../ui/icons";
import type { Status } from "../../types";

export default function AdminConsole() {
  const { account } = useAuth();
  const { push } = useToast();
  const { settings } = useAttendance();

  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState(toISODate(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
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
        return { account: a, totals, pct, target };
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

  function unlock() {
    if (code === loadFacultyPasscode()) {
      setUnlocked(true);
      setCodeError(null);
      push("Faculty console unlocked", "success");
    } else {
      setCodeError("Incorrect passcode.");
    }
  }

  function bulkMark(status: Status) {
    if (!sessions.length) return;
    let touched = 0;
    for (const a of listAccounts()) {
      const log = { ...loadLog(a.roll) };
      for (const s of sessions) log[logKey(dateStr, s.slot)] = status;
      saveLog(a.roll, log);
      touched++;
    }
    setRefreshKey((k) => k + 1);
    push(`Marked ${status} for ${touched} account${touched === 1 ? "" : "s"} on ${dateStr}`, "success");
  }

  if (!unlocked) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Faculty console</h1>
            <div className="sub">Class-wide attendance tools, gated behind a passcode.</div>
          </div>
        </div>
        <Card style={{ maxWidth: 460 }}>
          <CardHead title="Unlock" sub="Default passcode is sentinel — change it in Settings." />
          <CardBody>
            <Field label="Faculty passcode" htmlFor="fcode" error={codeError ?? undefined}>
              <div className="pw-wrap">
                <Input
                  id="fcode"
                  type="password"
                  className="mono"
                  value={code}
                  invalid={Boolean(codeError)}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && unlock()}
                  placeholder="••••••••"
                />
              </div>
            </Field>
            <Button variant="solid" block style={{ marginTop: 16 }} icon="key" onClick={unlock}>
              Unlock console
            </Button>
            <div className="hint" style={{ marginTop: 14 }}>
              <Icon name="info" size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              This gate is a convenience, not security — the passcode lives in this browser alongside the records.
            </div>
          </CardBody>
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
                `sentinel-roster-${toISODate(new Date())}.csv`,
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
          <div className="hint" style={{ marginTop: 12 }}>
            {prettyDate(fromISODate(dateStr))} — this overwrites any existing marks for those slots on every account.
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
                  downloadFile("sentinel-import-template.csv", templateCsv(), "text/csv;charset=utf-8");
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
                    downloadFile("sentinel-import-report.csv", importReportCsv(preview.rows, preview.issues), "text/csv;charset=utf-8")
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
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="download"
                          onClick={() => {
                            const log = loadLog(r.account.roll);
                            downloadFile(
                              `sentinel-${r.account.roll}.csv`,
                              subjectSummaryCSV(r.account.roll, r.account.name, log, r.target),
                              "text/csv;charset=utf-8",
                            );
                            push(`Exported ${r.account.roll}`);
                          }}
                        >
                          CSV
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
