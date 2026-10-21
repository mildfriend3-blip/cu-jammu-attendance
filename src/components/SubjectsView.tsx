import type { CSSProperties } from "react";
import { SUBJECTS } from "../data/timetable";
import { adviceFor, computeTotals, percentage, subjectColor } from "../lib/attendance";
import { useStudent } from "../state/StudentContext";

export default function SubjectsView() {
  const { student } = useStudent();
  if (!student) return null;

  const totals = computeTotals(student.log);
  const target = student.target;
  const held = totals.held;

  const shortSubjects = Object.values(SUBJECTS).filter((s) => {
    const tally = totals.per[s.code];
    if (!tally) return false;
    const subjectHeld = tally.present + tally.absent;
    return subjectHeld > 0 && (tally.present * 100) / subjectHeld < target;
  });

  return (
    <div className="panel">
      <div className="card">
        <h2>How you&apos;re doing</h2>
        <p className="sub">
          {held
            ? `${totals.present} present, ${totals.absent} absent across ${held} classes held. Target ${target}%.`
            : "Nothing marked yet. Head to “Mark today” to start logging."}
        </p>

        <div className="sgrid">
          {Object.values(SUBJECTS).map((subject) => {
            const tally = totals.per[subject.code] ?? { present: 0, absent: 0, cancelled: 0 };
            const subjectHeld = tally.present + tally.absent;
            const pct = percentage(tally.present, subjectHeld);
            const advice = adviceFor(tally.present, subjectHeld, target);
            const colour =
              pct === null
                ? "var(--ink-3)"
                : pct >= target
                  ? "var(--sage)"
                  : pct >= target - 10
                    ? "var(--amber)"
                    : "var(--red)";

            return (
              <div className="scard" key={subject.code} style={{ "--sc": subjectColor(subject.code) } as CSSProperties}>
                <div className="hd">
                  <div>
                    <div className="code">{subject.code}</div>
                    <div className="nm">{subject.name}</div>
                    <div className="fac">{subject.faculty}</div>
                  </div>
                  <div className="pct" style={{ color: colour }}>
                    {pct === null ? "—" : `${pct.toFixed(1)}%`}
                    <small>{subjectHeld} held</small>
                  </div>
                </div>
                <div className="bar">
                  <i style={{ width: `${pct ?? 0}%`, background: colour }} />
                </div>
                <div className="counts">
                  <span>
                    Present <b>{tally.present}</b>
                  </span>
                  <span>
                    Absent <b>{tally.absent}</b>
                  </span>
                  {tally.cancelled > 0 && (
                    <span>
                      Cancelled <b>{tally.cancelled}</b>
                    </span>
                  )}
                </div>
                <div className={`verdict ${advice.verdict}`}>{advice.text}</div>
              </div>
            );
          })}
        </div>
      </div>

      {shortSubjects.length > 0 && (
        <div className="warnbox">
          <b>Below {target}%:</b> {shortSubjects.map((s) => s.name).join(", ")}. Bump these up before the
          department check.
        </div>
      )}
    </div>
  );
}
