import { Link } from "react-router-dom";
import { TT } from "../data/timetable";
import { asDayName, fromISODate, prettyDate, weekdayName } from "../lib/date";
import { subjectName } from "../lib/attendance";
import { useStudent } from "../state/StudentContext";
import type { SlotKey, Status } from "../types";

interface Entry {
  slot: SlotKey;
  status: Status;
}

export default function HistoryView() {
  const { student } = useStudent();
  if (!student) return null;

  const byDate = new Map<string, Entry[]>();
  for (const [key, status] of Object.entries(student.log)) {
    const [isoDate, slot] = key.split("|");
    const list = byDate.get(isoDate) ?? [];
    list.push({ slot: slot as SlotKey, status });
    byDate.set(isoDate, list);
  }

  const dates = [...byDate.keys()].sort().reverse();

  return (
    <div className="panel">
      <div className="card">
        <h2>Marked days</h2>
        <p className="sub">
          Every date you&apos;ve marked, newest first. Tap a subject chip to jump back and edit that day.
        </p>

        {dates.length === 0 && <div className="empty">No attendance marked yet.</div>}

        {dates.map((isoDate) => {
          const date = fromISODate(isoDate);
          const day = asDayName(date);
          const entries = (byDate.get(isoDate) ?? []).sort((a, b) => a.slot.localeCompare(b.slot));
          const present = entries.filter((e) => e.status === "P").length;
          const absent = entries.filter((e) => e.status === "A").length;
          const cancelled = entries.filter((e) => e.status === "C").length;

          return (
            <div className="hist-item" key={isoDate}>
              <div className="hh">
                <div className="hd2">
                  {prettyDate(date)}
                  <small>{weekdayName(date)}</small>
                </div>
                <div className="tally">
                  {present}P · {absent}A{cancelled ? ` · ${cancelled}C` : ""}
                </div>
              </div>
              <div className="chips">
                {entries.map((entry) => {
                  const code = day ? TT[day][entry.slot] : undefined;
                  return (
                    <Link
                      key={entry.slot}
                      className={`chip ${entry.status}`}
                      to={`/today?d=${isoDate}`}
                      title={code ? subjectName(code) : undefined}
                    >
                      {code ? `${code.slice(0, 4)}·${entry.slot}` : `·${entry.slot}`} {entry.status}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
