import { useMemo, useState } from "react";
import { SUBJECTS } from "../../data/timetable";
import { computeTotals, logKey, percentage, sessionsOn, subjectHeld } from "../../lib/attendance";
import { rosterCSV, downloadFile, subjectSummaryCSV } from "../../lib/export";
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
