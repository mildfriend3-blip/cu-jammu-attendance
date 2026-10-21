import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
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
} from "../../data/timetable";
import { useClock } from "../../hooks/useClock";
import { asDayName, minutesOf } from "../../lib/date";
import { Badge, Button, Card, CardBody, CardHead, EmptyState, Input, Modal, Segmented, Select } from "../ui";
import { Icon } from "../ui/icons";
import type { DayName, SlotKey } from "../../types";

type TypeFilter = "all" | "theory" | "lab";
interface Detail {
  day: DayName;
  slot: SlotKey;
  code: string;
}

export default function Timetable() {
  const now = useClock(30_000);
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
    for (const day of DAYS) for (const slot of SLOTS) if (TT[day][slot.key] && isVisible(day, slot.key, TT[day][slot.key] as string)) n++;
    return n;
  }, [isVisible]);

  const totalSessions = useMemo(() => DAYS.reduce((n, d) => n + Object.keys(TT[d]).length, 0), []);

  function toggleHidden(code: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Timetable</h1>
          <div className="sub">
            {META.programme} · {META.semester} ({META.classTag}) · {META.room}
          </div>
        </div>
        <div className="actions">
          <Button icon="printer" onClick={() => window.print()}>
            Print
          </Button>
          <Link to="/attendance" className="btn solid">
            <Icon name="checkCircle" size={16} /> Mark attendance
          </Link>
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <CardBody style={{ display: "grid", gap: 14 }}>
          <div className="toolbar">
            <Input
              className="grow"
              type="search"
              placeholder="Search course code, subject or faculty…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select style={{ maxWidth: 260 }} value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="all">All subjects</option>
              {Object.values(SUBJECTS).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Segmented<TypeFilter>
              value={type}
              label="Session type"
              onChange={setType}
              options={[
                { value: "all", label: "All" },
                { value: "theory", label: "Theory" },
                { value: "lab", label: "Labs" },
              ]}
            />
            {(hidden.size > 0 || subject !== "all" || type !== "all" || query) && (
              <Button
                variant="ghost"
                icon="refresh"
                onClick={() => {
                  setHidden(new Set());
                  setSubject("all");
                  setType("all");
                  setQuery("");
                }}
              >
                Reset
              </Button>
            )}
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
                <span className="sw" style={{ background: `var(${s.hue})` }} />
                {s.short}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "var(--ink-3)" }}>
            <span className="mono">
              {visibleCount} of {totalSessions} sessions in view
            </span>
            <span>·</span>
            <span className="mono">lunch {LUNCH.time}</span>
            <span>·</span>
            <span className="mono">effective {META.effectiveFrom}</span>
          </div>
        </CardBody>
      </Card>

      <div className="boardwrap">
        <table className="board">
          <thead>
            <tr>
              <th className="slotcol">
                <span className="dd">Slot</span>
                <span className="dn">Time</span>
              </th>
              {DAYS.map((day) => (
                <th key={day} className={today === day ? "today" : ""}>
                  <span className="dd">{day.slice(0, 3)}</span>
                  <span className="dn">{day}</span>
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

      <Card style={{ marginTop: 14 }}>
        <CardHead
          title="Notes & venues"
          sub="Venue changes and lab locations for this class"
          actions={
            <Link to="/settings" className="btn sm">
              Settings
            </Link>
          }
        />
        <CardBody>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.9 }}>
            <li>Lunch break runs {LUNCH.time}.</li>
            <li>On Friday, Semester I classes marked “Class 6” shift to that room for the day.</li>
            <li>Some lab sessions run in alternate venues (ECE Department, PMMMT Lab) — see the class card.</li>
            <li>
              Source: {META.department} timetable, {META.term}, effective {META.effectiveFrom}.
            </li>
          </ul>
        </CardBody>
      </Card>

      {detail && <ClassModal detail={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function SlotRow({
  slotKey,
  label,
  time,
  today,
  now,
  isVisible,
  onOpen,
}: {
  slotKey: SlotKey;
  label: string;
  time: string;
  today: DayName | null;
  now: Date;
  isVisible: (day: DayName, slot: SlotKey, code: string) => boolean;
  onOpen: (d: Detail) => void;
}) {
  const [start, end] = time.split("–").map(minutesOf);
  const mins = now.getHours() * 60 + now.getMinutes();
  const isNowSlot = mins >= start && mins < end;

  return (
    <>
      {slotKey === "E" && (
        <tr className="lunchrow">
          <th className="slotcol" scope="row">
            <span className="st">{LUNCH.time}</span>
            <span className="sc">Lunch</span>
          </th>
          {DAYS.map((d) => (
            <td key={d} />
          ))}
        </tr>
      )}
      <tr>
        <th className="slotcol" scope="row">
          <span className="sc">{label}</span>
          <span className="st">{time}</span>
        </th>
        {DAYS.map((day) => {
          const code = TT[day][slotKey];
          if (!code) return <td key={day} className="cellp" />;
          const sub = SUBJECTS[code];
          const isLab = LAB_SESSIONS.has(`${day}|${slotKey}`);
          const dim = !isVisible(day, slotKey, code);
          const isNow = today === day && isNowSlot;
          return (
            <td key={day} className={`cellp ${isNow ? "now" : ""}`.trim()}>
              <button
                className={`cls ${dim ? "dim" : ""}`.trim()}
                style={{ ["--sc" as string]: `var(${sub.hue})` } as CSSProperties}
                onClick={() => onOpen({ day, slot: slotKey, code })}
              >
                <span className="cc">{code}</span>
                <span className="cn">{sub.short}</span>
                <span className="cf">{sub.faculty}</span>
                {isLab && <span className="tag">Lab</span>}
              </button>
            </td>
          );
        })}
      </tr>
    </>
  );
}

function ClassModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const sub = SUBJECTS[detail.code];
  const meta = SLOT_BY_KEY[detail.slot];
  const isLab = LAB_SESSIONS.has(`${detail.day}|${detail.slot}`);
  const note = SESSION_NOTES[`${detail.day}|${detail.slot}`];

  return (
    <Modal
      title="Class detail"
      accent={`var(${sub.hue})`}
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="mono" style={{ fontSize: 11.5, color: `var(${sub.hue})` }}>
        {sub.code}
      </div>
      <h3 style={{ fontSize: 19, margin: "5px 0 16px" }}>{sub.name}</h3>
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
        <dd>
          <Badge tone={isLab ? "info" : "neutral"}>{isLab ? "Laboratory" : "Theory"}</Badge>
        </dd>
        <dt>Room</dt>
        <dd>{note?.startsWith("Venue") ? `Fabricated Building ${note.replace("Venue: ", "")}` : META.room}</dd>
        <dt>Notes</dt>
        <dd>{note ?? "—"}</dd>
      </dl>
      <div style={{ marginTop: 18 }}>
        <EmptyState
          icon="info"
          title="Marking happens in the day view"
          body="Use Mark attendance to record Present / Absent / Cancelled for a specific date."
          action={
            <Link to="/attendance" className="btn solid" onClick={onClose}>
              Go to marking
            </Link>
          }
        />
      </div>
    </Modal>
  );
}
