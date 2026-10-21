import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TT } from "../../data/timetable";
import { subjectName, subjectShort } from "../../lib/attendance";
import { asDayName, fromISODate, relativeDay, weekdayName } from "../../lib/date";
import { attendanceLogCSV, downloadFile, subjectSummaryCSV } from "../../lib/export";
import { useAttendance } from "../../state/AttendanceContext";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { Badge, Button, Card, CardBody, CardHead, EmptyState, Segmented } from "../ui";
import { Icon } from "../ui/icons";
import type { SlotKey, Status } from "../../types";

type Filter = "all" | "P" | "A" | "C";

export default function History() {
  const { account } = useAuth();
  const { log, settings } = useAttendance();
  const { push } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(15);

  const byDate = useMemo(() => {
    const map = new Map<string, { slot: SlotKey; status: Status }[]>();
    for (const [key, status] of Object.entries(log)) {
      const [iso, slot] = key.split("|");
      const list = map.get(iso) ?? [];
      list.push({ slot: slot as SlotKey, status });
      map.set(iso, list);
    }
    return [...map.entries()]
      .map(([iso, entries]) => ({
        iso,
        entries: entries.sort((a, b) => a.slot.localeCompare(b.slot)),
      }))
      .sort((a, b) => b.iso.localeCompare(a.iso));
  }, [log]);

  const filtered = useMemo(
    () =>
      byDate
        .map((d) => ({ ...d, entries: filter === "all" ? d.entries : d.entries.filter((e) => e.status === filter) }))
        .filter((d) => d.entries.length > 0),
    [byDate, filter],
  );

  const totalsRow = useMemo(() => {
    const counts = { P: 0, A: 0, C: 0 };
    for (const status of Object.values(log)) counts[status]++;
    return counts;
  }, [log]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>History</h1>
          <div className="sub">
            {byDate.length} day{byDate.length === 1 ? "" : "s"} recorded · {totalsRow.P} present · {totalsRow.A} absent
            {totalsRow.C ? ` · ${totalsRow.C} cancelled` : ""}
          </div>
        </div>
        <div className="actions">
          <Button
            icon="download"
            onClick={() => {
              if (!account) return;
              downloadFile(
                `cujatt-log-${account.roll}.csv`,
                attendanceLogCSV(account.roll, account.name, log),
                "text/csv;charset=utf-8",
              );
              push("Attendance log exported", "success");
            }}
          >
            Export log (CSV)
          </Button>
          <Button
            icon="download"
            onClick={() => {
              if (!account) return;
              downloadFile(
                `cujatt-summary-${account.roll}.csv`,
                subjectSummaryCSV(account.roll, account.name, log, settings.target),
                "text/csv;charset=utf-8",
              );
              push("Subject summary exported", "success");
            }}
          >
            Summary (CSV)
          </Button>
        </div>
      </div>

      <Card>
        <CardHead
          title="Recorded days"
          sub="Tap any entry to jump back and edit that day"
          actions={
            <Segmented<Filter>
              value={filter}
              label="Filter by status"
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "P", label: "Present" },
                { value: "A", label: "Absent" },
                { value: "C", label: "Cancelled" },
              ]}
            />
          }
        />

        <CardBody>
          {filtered.length === 0 && (
            <EmptyState
              icon="clock"
              title="Nothing recorded"
              body="Once you mark attendance it shows up here, grouped by day, with a full audit trail you can export."
              action={
                <Link to="/attendance" className="btn solid">
                  <Icon name="checkCircle" size={16} /> Mark attendance
                </Link>
              }
            />
          )}

          {filtered.slice(0, limit).map(({ iso, entries }) => {
            const date = fromISODate(iso);
            const day = asDayName(date);
            const p = entries.filter((e) => e.status === "P").length;
            const a = entries.filter((e) => e.status === "A").length;
            const c = entries.filter((e) => e.status === "C").length;
            return (
              <div
                key={iso}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r)",
                  background: "var(--surface-2)",
                  padding: "12px 14px",
                  marginBottom: 9,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {relativeDay(iso)}
                      <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: 8 }}>
                        {weekdayName(date)} · {iso}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge tone="ok">{p}P</Badge>
                    {a > 0 && <Badge tone="bad">{a}A</Badge>}
                    {c > 0 && <Badge>{c}C</Badge>}
                    <Link to={`/attendance?d=${iso}`} className="btn sm ghost">
                      Edit
                    </Link>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                  {entries.map((e) => {
                    const code = day ? TT[day][e.slot] : undefined;
                    return (
                      <Link
                        key={e.slot}
                        to={`/attendance?d=${iso}`}
                        className={`badge ${e.status === "P" ? "ok" : e.status === "A" ? "bad" : ""}`.trim()}
                        title={code ? subjectName(code) : undefined}
                        style={{ textDecoration: "none" }}
                      >
                        <span className="dot" />
                        {code ? subjectShort(code) : `slot ${e.slot}`} · {e.status}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length > limit && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
              <Button variant="ghost" icon="chevronDown" onClick={() => setLimit((l) => l + 20)}>
                Show {Math.min(20, filtered.length - limit)} more
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-3)" }}>
        <Icon name="info" size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
        The CSV export mirrors exactly what is stored locally — no data leaves your device unless you send it.
      </div>
    </>
  );
}
