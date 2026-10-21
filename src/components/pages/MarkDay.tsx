import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LAB_SESSIONS, SESSION_NOTES, SLOT_BY_KEY, SUBJECTS } from "../../data/timetable";
import { logKey, percentage, sessionsOn } from "../../lib/attendance";
import { addDays, asDayName, fromISODate, isSameDay, prettyDate, toISODate, weekdayName } from "../../lib/date";
import { useAttendance } from "../../state/AttendanceContext";
import { useToast } from "../../state/ToastContext";
import { Badge, Button, Card, CardBody, CardHead, EmptyState, ProgressBar } from "../ui";
import { Icon } from "../ui/icons";

export default function MarkDay() {
  const { log, setStatus, markAllPresent, clearDay, settings } = useAttendance();
  const { push } = useToast();
  const [params, setParams] = useSearchParams();

  const dateStr = params.get("d") ?? toISODate(new Date());
  const date = fromISODate(dateStr);
  const day = asDayName(date);
  const sessions = useMemo(() => (day ? sessionsOn(dateStr) : []), [day, dateStr]);

  const marked = sessions.map((s) => log[logKey(dateStr, s.slot)]).filter(Boolean);
  const present = marked.filter((s) => s === "P").length;
  const absent = marked.filter((s) => s === "A").length;
  const dayPct = percentage(present, present + absent);

  function goTo(next: Date) {
    setParams({ d: toISODate(next) }, { replace: true });
  }

  // 5-day strip centred on the current date, weekdays only
  const strip = useMemo(() => {
    const out: Date[] = [];
    let cursor = addDays(date, -2);
    while (out.length < 5) {
      if (!asDayName(cursor)) cursor = addDays(cursor, 1);
      else {
        out.push(cursor);
        cursor = addDays(cursor, 1);
      }
    }
    return out;
  }, [date]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mark attendance</h1>
          <div className="sub">Record Present, Absent or Cancelled for each scheduled class.</div>
        </div>
        <div className="actions">
          <Link to="/history" className="btn">
            <Icon name="clock" size={16} /> History
          </Link>
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <CardBody>
          <div className="datebar">
            <button className="nav" onClick={() => goTo(addDays(date, -1))} aria-label="Previous day">
              <Icon name="chevronLeft" size={16} />
            </button>
            <div className="dt">
              <b>{prettyDate(date)}</b>
              <span>
                {day ? `${day} · ${sessions.length} scheduled` : "Weekend — no classes"}
                {isSameDay(date, new Date()) ? " · today" : ""}
              </span>
            </div>
            <input type="date" value={dateStr} onChange={(e) => e.target.value && goTo(fromISODate(e.target.value))} aria-label="Pick a date" />
            <button className="nav" onClick={() => goTo(addDays(date, 1))} aria-label="Next day">
              <Icon name="chevronRight" size={16} />
            </button>
            <Button size="sm" onClick={() => goTo(new Date())}>
              Today
            </Button>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
            {strip.map((d) => {
              const iso = toISODate(d);
              const active = iso === dateStr;
              const count = sessionsOn(iso).length;
              return (
                <button
                  key={iso}
                  className={`lg ${active ? "on" : ""}`}
                  style={{ flexDirection: "column", alignItems: "flex-start", gap: 1, borderRadius: 10, padding: "7px 11px", minWidth: 72 }}
                  onClick={() => goTo(d)}
                >
                  <span className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.8 }}>
                    {weekdayName(d).slice(0, 3)}
                  </span>
                  <span className="mono tnum" style={{ fontSize: 12.5 }}>
                    {d.getDate()}/{d.getMonth() + 1}
                  </span>
                  <span className="mono" style={{ fontSize: 9.5, opacity: 0.7 }}>
                    {count} cls
                  </span>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead
          title={day ? `${sessions.length} sessions` : "No sessions"}
          sub={
            day
              ? `${marked.length} marked · ${present} present · ${absent} absent${dayPct === null ? "" : ` · ${dayPct.toFixed(1)}%`}`
              : "Pick a weekday to mark attendance"
          }
          actions={
            day && sessions.length > 0 ? (
              <>
                <Button
                  size="sm"
                  icon="check"
                  onClick={() => {
                    markAllPresent(dateStr);
                    push("Marked all present", "success");
                  }}
                >
                  All present
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="refresh"
                  onClick={() => {
                    clearDay(dateStr);
                    push("Day cleared");
                  }}
                >
                  Clear
                </Button>
              </>
            ) : undefined
          }
        />

        {day && marked.length > 0 && (
          <div style={{ padding: "0 20px" }}>
            <ProgressBar value={dayPct ?? 0} />
          </div>
        )}

        <CardBody>
          {!day && (
            <EmptyState
              icon="calendar"
              title={`${weekdayName(date)} — no classes`}
              body="Attendance only applies to Monday–Friday. Pick a weekday from the strip above."
            />
          )}

          {day && sessions.length === 0 && <EmptyState icon="info" title="Nothing scheduled" />}

          {day &&
            sessions.map((session) => {
              const sub = SUBJECTS[session.code];
              const meta = SLOT_BY_KEY[session.slot];
              const status = log[logKey(dateStr, session.slot)];
              const isLab = LAB_SESSIONS.has(`${day}|${session.slot}`);
              const note = SESSION_NOTES[`${day}|${session.slot}`];
              return (
                <div className="sess" key={session.slot} style={{ ["--sc" as string]: `var(${sub.hue})` }}>
                  <div className="info">
                    <div className="cc mono">
                      {session.code} · slot {session.slot} {isLab && <span className="tag" style={{ marginLeft: 6 }}>lab</span>}
                    </div>
                    <div className="cn">{sub.name}</div>
                    <div className="cm">
                      {meta.time} · {sub.faculty}
                      {note ? ` · ${note}` : ""}
                    </div>
                  </div>
                  <div className="mark">
                    {(
                      [
                        ["P", "Present"],
                        ["A", "Absent"],
                        ["C", "Cancelled"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        data-s={value}
                        className={status === value ? "on" : ""}
                        onClick={() => setStatus(dateStr, session.slot, value)}
                        aria-label={label}
                        title={label}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
        </CardBody>
      </Card>

      {day && marked.length > 0 && (
        <Card style={{ marginTop: 14 }}>
          <CardBody style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone={dayPct !== null && dayPct >= settings.target ? "ok" : "warn"}>
              day rate {dayPct === null ? "—" : `${dayPct.toFixed(0)}%`}
            </Badge>
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Cancelled classes are excluded from every percentage.
            </span>
          </CardBody>
        </Card>
      )}
    </>
  );
}
