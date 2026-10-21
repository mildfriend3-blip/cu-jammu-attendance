import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  DAYS,
  LAB_SESSIONS,
  LUNCH,
  META,
  SESSION_NOTES,
  SLOTS,
  SLOT_BY_KEY,
  SUBJECTS,
  TT,
} from "../data/timetable";
import { useClock } from "../hooks/useClock";
import { asDayName } from "../lib/date";
import type { DayName, SlotKey } from "../types";

interface Detail {
  day: DayName;
  slot: SlotKey;
  code: string;
}

type TypeFilter = "all" | "theory" | "lab";

export default function TimetableView() {
  const now = useClock(30000);
  const today = asDayName(now);

  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set<string>());
  const [detail, setDetail] = useState<Detail | null>(null);

  const isVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (day: DayName, slot: SlotKey, code: string): boolean => {
      const sub = SUBJECTS[code];
      if (!sub) return false;
      if (hidden.has(code)) return false;
      if (subject !== "all" && code !== subject) return false;
      const isLab = LAB_SESSIONS.has(`${day}|${slot}`);
      if (type === "lab" && !isLab) return false;
      if (type === "theory" && isLab) return false;
      if (q && !`${code} ${sub.name} ${sub.faculty}`.toLowerCase().includes(q)) return false;
      return true;
    };
  }, [query, subject, type, hidden]);

  const visibleCount = useMemo(() => {
    let n = 0;
    for (const day of DAYS) {
      for (const slot of SLOTS) {
        const code = TT[day][slot.key];
        if (code && isVisible(day, slot.key, code)) n++;
      }
    }
    return n;
  }, [isVisible]);

  function toggleHidden(code: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <>
      <div className="card">
        <h2>
          {META.programme} — {META.semester}
        </h2>
        <p className="sub">
          {META.university} · {META.department} · {META.term}. Room {META.room}. Click any class for details.
        </p>

        <div className="controls">
          <input
            className="t grow"
            type="search"
            placeholder="Search course code, subject or faculty…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="t" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="all">All subjects</option>
            {Object.values(SUBJECTS).map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          {(["all", "theory", "lab"] as const).map((option) => (
            <button
              key={option}
              className={`btn sm ${type === option ? "primary" : ""}`}
              onClick={() => setType(option)}
            >
              {option === "all" ? "All" : option === "theory" ? "Theory" : "Labs"}
            </button>
          ))}
        </div>

        <div className="legend">
          {Object.values(SUBJECTS).map((s) => (
            <span
              key={s.code}
              className={`lg ${hidden.has(s.code) ? "off" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => toggleHidden(s.code)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") toggleHidden(s.code);
              }}
            >
              <span className="sw" style={{ background: `var(${s.color})` }} />
              {s.name}
            </span>
          ))}
        </div>

        <p className="note">{visibleCount} sessions in view.</p>
      </div>

      <div className="boardwrap">
        <table className="board">
          <thead>
            <tr>
              <th className="slotcol">
                <span className="dnum">Slot</span>
                <span className="dname">Time</span>
              </th>
              {DAYS.map((day) => (
                <th key={day} className={today === day ? "today" : ""}>
                  <span className="dnum">{day.slice(0, 3)}</span>
                  <span className="dname">{day}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) => (
              <SlotRow
                key={slot.key}
                slotKey={slot.key}
                label={slot.label}
                time={slot.time}
                today={today}
                now={now}
                isVisible={isVisible}
                onOpen={setDetail}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Notes</h2>
        <p className="note">
          Lunch break {LUNCH.time}. On Friday, Semester I classes marked “Class 6” shift to that room for the
          day. Some lab sessions carry an alternate venue (ECE Department, PMMMT Lab) — see the class card.
          Source: {META.department} timetable, {META.term}, effective {META.effectiveFrom}.
        </p>
      </div>

      {detail && <ClassModal detail={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

interface RowProps {
  slotKey: SlotKey;
  label: string;
  time: string;
  today: DayName | null;
  now: Date;
  isVisible: (day: DayName, slot: SlotKey, code: string) => boolean;
  onOpen: (detail: Detail) => void;
}

function SlotRow({ slotKey, label, time, today, now, isVisible, onOpen }: RowProps) {
  const isNowSlot = isCurrentSlot(now, time);
  return (
    <>
      {slotKey === "E" && (
        <tr className="lunch">
          <th className="slotcol" scope="row">
            <span className="t1">{LUNCH.time}</span>
            <span className="t2">Lunch</span>
          </th>
          {DAYS.map((d) => (
            <td key={d} />
          ))}
        </tr>
      )}
      <tr>
        <th className="slotcol" scope="row">
          <span className="code">{label}</span>
          <span className="t1">{time}</span>
          <span className="t2">Slot {slotKey}</span>
        </th>
        {DAYS.map((day) => {
          const code = TT[day][slotKey];
          if (!code) return <td key={day} className="cell" />;
          const sub = SUBJECTS[code];
          const isLab = LAB_SESSIONS.has(`${day}|${slotKey}`);
          const dim = !isVisible(day, slotKey, code);
          const isNow = today === day && isNowSlot;
          return (
            <td key={day} className={`cell ${isNow ? "isnow" : ""}`}>
              <button
                className={`cls ${dim ? "dimmed" : ""}`}
                style={{ "--c": `var(${sub.color})` } as CSSProperties}
                onClick={() => onOpen({ day, slot: slotKey, code })}
              >
                <span className="c">{code}</span>
                <span className="n">{sub.name}</span>
                <span className="f">{sub.faculty}</span>
                {isLab && <span className="tag">Lab</span>}
              </button>
            </td>
          );
        })}
      </tr>
    </>
  );
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isCurrentSlot(now: Date, range: string): boolean {
  const [start, end] = range.split("–");
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= toMinutes(start) && mins < toMinutes(end);
}

function ClassModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const sub = SUBJECTS[detail.code];
  const meta = SLOT_BY_KEY[detail.slot];
  const isLab = LAB_SESSIONS.has(`${detail.day}|${detail.slot}`);
  const note = SESSION_NOTES[`${detail.day}|${detail.slot}`];

  return (
    <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ "--mc": `var(${sub.color})` } as CSSProperties}>
        <div className="mcode">{detail.code}</div>
        <h3>{sub.name}</h3>
        <dl>
          <dt>Day</dt>
          <dd>{detail.day}</dd>
          <dt>Time</dt>
          <dd className="mono">
            {meta.label} · {meta.time}
          </dd>
          <dt>Faculty</dt>
          <dd>{sub.faculty}</dd>
          <dt>Type</dt>
          <dd>{isLab ? "Laboratory / Practical" : "Theory lecture"}</dd>
          <dt>Room</dt>
          <dd>
            {note?.startsWith("Venue")
              ? `Fabricated Building ${note.replace("Venue: ", "")}`
              : META.room}
          </dd>
          <dt>Notes</dt>
          <dd>{note ?? "—"}</dd>
        </dl>
        <button className="btn primary wide" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
