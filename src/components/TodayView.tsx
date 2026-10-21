import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SESSION_NOTES, SLOT_BY_KEY, SUBJECTS } from "../data/timetable";
import { addDays, asDayName, fromISODate, isSameDay, prettyDate, toISODate } from "../lib/date";
import { logKey, sessionsOn, subjectColor } from "../lib/attendance";
import { useStudent } from "../state/StudentContext";
import type { Status } from "../types";

export default function TodayView() {
  const { student, setStatus, setMany, showToast } = useStudent();
  const [params, setParams] = useSearchParams();

  if (!student) return null;

  const dateStr = params.get("d") ?? toISODate(new Date());
  const date = fromISODate(dateStr);
  const day = asDayName(date);
  const sessions = day ? sessionsOn(dateStr) : [];

  function goTo(next: Date) {
    setParams({ d: toISODate(next) }, { replace: true });
  }

  return (
    <div className="panel">
      <div className="card">
        <div className="datenav">
          <button className="dbtn" onClick={() => goTo(addDays(date, -1))} title="Previous day">
            ‹
          </button>
          <div className="dtxt">
            {prettyDate(date)}
            <small>{day ? `${day} · Semester I (I-CCS)` : "No classes (weekend)"}</small>
          </div>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => e.target.value && goTo(fromISODate(e.target.value))}
          />
          <button className="dbtn" onClick={() => goTo(addDays(date, 1))} title="Next day">
            ›
          </button>
          <button className="btn sm" onClick={() => goTo(new Date())}>
            Today
          </button>
        </div>

        {!day && (
          <div className="empty">
            No scheduled classes on {date.toLocaleDateString("en-IN", { weekday: "long" })}. Pick a weekday
            to mark attendance.
          </div>
        )}

        {day && sessions.length === 0 && <div className="empty">No classes scheduled for this day.</div>}

        {day &&
          sessions.map((session) => {
            const sub = SUBJECTS[session.code];
            const meta = SLOT_BY_KEY[session.slot];
            const current = student.log[logKey(dateStr, session.slot)];
            const note = SESSION_NOTES[`${day}|${session.slot}`];
            return (
              <div className="sess" key={session.slot} style={{ "--sc": subjectColor(session.code) } as CSSProperties}>
                <div className="info">
                  <div className="code">
                    {session.code} · Slot {session.slot}
                  </div>
                  <div className="nm">{sub.name}</div>
                  <div className="mt">
                    {meta.time} · {sub.faculty}
                    {note ? ` · ${note}` : ""}
                  </div>
                </div>
                <div className="seg">
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
                      className={current === value ? "on" : ""}
                      onClick={() => setStatus(dateStr, session.slot, value as Status)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

        {day && sessions.length > 0 && (
          <div className="rowbtns">
            <button
              className="btn sm"
              onClick={() => {
                setMany(dateStr, sessions.map((s) => ({ slot: s.slot, status: "P" as Status })));
                showToast("Marked all present");
              }}
            >
              Mark all present
            </button>
            <button
              className="btn sm ghost"
              onClick={() => {
                setMany(dateStr, sessions.map((s) => ({ slot: s.slot, status: null })));
                showToast("Day cleared");
              }}
            >
              Clear this day
            </button>
            {!isSameDay(date, new Date()) && (
              <Link className="btn sm ghost" to="/today">
                Jump to today
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
