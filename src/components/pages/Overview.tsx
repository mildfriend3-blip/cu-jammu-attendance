import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LUNCH, META, SLOTS, SUBJECTS, TT } from "../../data/timetable";
import { useClock } from "../../hooks/useClock";
import { dailySeries, daysMarked, presentStreak, rollingRate, weeklyLoad } from "../../lib/analytics";
import { adviceFor, percentage, riskOf, subjectHeld } from "../../lib/attendance";
import { addDays, asDayName, daysBetween, formatMinutes, fromISODate, minutesOf, prettyDate, toISODate } from "../../lib/date";
import { useAttendance } from "../../state/AttendanceContext";
import { useAuth } from "../../state/AuthContext";
import { Badge, Card, CardBody, CardHead, ProgressBar, Stat } from "../ui";
import { Bars, Ring, Sparkline } from "../ui/charts";
import { Icon } from "../ui/icons";

export default function Overview() {
  const { account } = useAuth();
  const { totals, settings, log, setStatus, locks, isDayLocked } = useAttendance();
  const now = useClock(15_000);

  const pct = percentage(totals.present, totals.held);
  const risk = riskOf(pct, settings.target);
  const today = asDayName(now);
  const todayISO = toISODate(now);
  const todayLocked = isDayLocked(todayISO);

  const series = useMemo(() => dailySeries(log, 14, now), [log, now]);
  const spark = useMemo(() => series.map((p) => p.rate ?? 0), [series]);
  const streak = useMemo(() => presentStreak(log), [log]);
  const marked = useMemo(() => daysMarked(log), [log]);
  const rate7 = useMemo(() => rollingRate(log, 7, now), [log, now]);
  const load = useMemo(() => weeklyLoad(), []);

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const todaysSlots = today ? SLOTS.filter((s) => TT[today][s.key]) : [];
  const current = todaysSlots.find((s) => {
    const [a, b] = s.time.split("–").map(minutesOf);
    return nowMins >= a && nowMins < b;
  });
  const upcoming = todaysSlots.find((s) => minutesOf(s.time.split("–")[0]) > nowMins);

  const atRisk = Object.values(SUBJECTS)
    .map((s) => {
      const tally = totals.per[s.code];
      const held = subjectHeld(tally);
      return { subject: s, held, pct: percentage(tally?.present ?? 0, held) };
    })
    .filter((r) => r.held > 0 && (r.pct ?? 0) < settings.target);

  const examIn = settings.examDate ? daysBetween(now, fromISODate(settings.examDate)) : null;

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {greeting}, {account?.name.split(" ")[0]}
          </h1>
          <div className="sub">
            {prettyDate(now)} · {today ? `${today} · ${META.room}` : "Weekend — no classes scheduled"}
          </div>
        </div>
        <div className="actions">
          <Link to="/attendance" className="btn solid">
            <Icon name="checkCircle" size={16} /> Mark today
          </Link>
          <Link to="/timetable" className="btn">
            <Icon name="calendar" size={16} /> Timetable
          </Link>
        </div>
      </div>

      {risk === "bad" && (
        <Card className="pad" >
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Icon name="alert" size={20} style={{ color: "var(--danger)" }} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 600 }}>Attendance is below your {settings.target}% target</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
                {atRisk.length
                  ? `Short in ${atRisk.map((r) => r.subject.short).join(", ")}. ${adviceFor(totals.present, totals.held, settings.target).text}`
                  : adviceFor(totals.present, totals.held, settings.target).text}
              </div>
            </div>
            <Link to="/subjects" className="btn outline">
              Review subjects
            </Link>
          </div>
        </Card>
      )}

      <div className="grid c4" style={{ marginBottom: 14 }}>
        <Stat
          label="Overall attendance"
          value={pct === null ? "—" : pct.toFixed(1)}
          unit="%"
          icon="target"
          accent
          detail={
            <Badge tone={risk === "ok" ? "ok" : risk === "warn" ? "warn" : risk === "bad" ? "bad" : "neutral"}>
              target {settings.target}%
            </Badge>
          }
        />
        <Stat
          label="Classes held"
          value={totals.held}
          icon="checkCircle"
          detail={`${totals.present} present · ${totals.absent} absent${totals.cancelled ? ` · ${totals.cancelled} cancelled` : ""}`}
        />
        <Stat
          label="Last 7 days"
          value={rate7 === null ? "—" : rate7.toFixed(1)}
          unit="%"
          icon="trend"
          detail="rolling attendance rate"
        />
        <Stat
          label="Present streak"
          value={streak}
          icon="flame"
          detail={`${marked} day${marked === 1 ? "" : "s"} marked`}
        >
          {spark.some((v) => v > 0) && <Sparkline points={spark} width={110} height={38} />}
        </Stat>
      </div>

      <div className="grid c2" style={{ marginBottom: 14, alignItems: "start" }}>
        <Card>
          <CardHead
            title="Today's schedule"
            sub={
              today
                ? todayLocked
                  ? `${todaysSlots.length} sessions · submitted and locked`
                  : `${todaysSlots.length} sessions · tap to mark`
                : "No classes today"
            }
            actions={
              <Link to="/attendance" className="btn sm">
                Open day view
              </Link>
            }
          />
          <CardBody style={{ padding: "14px 20px 18px" }}>
            {!today && (
              <div className="empty" style={{ padding: "26px 0" }}>
                <Icon name="calendar" size={22} style={{ color: "var(--ink-3)", marginBottom: 8 }} />
                <div className="t">It&apos;s the weekend</div>
                <div style={{ fontSize: 13 }}>Nothing scheduled — enjoy the break.</div>
              </div>
            )}

            {today && (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  {current && (
                    <Badge tone="info" dot>
                      in progress · {current.time}
                    </Badge>
                  )}
                  {!current && upcoming && (
                    <Badge tone="ok" dot>
                      next {upcoming.label} at {formatMinutes(minutesOf(upcoming.time.split("–")[0]))}
                    </Badge>
                  )}
                  {!current && !upcoming && <Badge>all done for today</Badge>}
                  {todayLocked && (
                    <Badge tone="warn">
                      <Icon name="lock" size={11} /> locked
                    </Badge>
                  )}
                </div>

                {todaysSlots.map((slot) => {
                  const code = TT[today!][slot.key] as string;
                  const subject = SUBJECTS[code];
                  const status = log[`${todayISO}|${slot.key}`];
                  const [a, b] = slot.time.split("–").map(minutesOf);
                  const isNow = nowMins >= a && nowMins < b;
                  return (
                    <div
                      key={slot.key}
                      className="sess"
                      style={{ ["--sc" as string]: `var(${subject.hue})`, marginTop: 8, borderColor: isNow ? "var(--line-accent)" : undefined }}
                    >
                      <div className="info">
                        <div className="cc mono">{code} · slot {slot.key}</div>
                        <div className="cn">{subject.short}</div>
                        <div className="cm">{slot.time} · {subject.faculty}</div>
                      </div>
                      <div className="mark">
                        {(["P", "A", "C"] as const).map((s) => (
                          <button
                            key={s}
                            data-s={s}
                            className={status === s ? "on" : ""}
                            disabled={todayLocked}
                            style={todayLocked ? { cursor: "not-allowed", opacity: 0.75 } : undefined}
                            title={todayLocked ? "Locked — faculty unlock required" : undefined}
                            onClick={() => setStatus(todayISO, slot.key, s)}
                            aria-label={s === "P" ? "Present" : s === "A" ? "Absent" : "Cancelled"}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CardBody>
        </Card>

        <div className="grid" style={{ gap: 14 }}>
          <Card>
            <CardHead title="Standing" sub={`Target ${settings.target}%`} />
            <CardBody style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <Ring
                value={pct}
                size={104}
                color={risk === "ok" ? "var(--accent)" : risk === "warn" ? "var(--warn)" : "var(--danger)"}
              />
              <div style={{ flex: 1, minWidth: 190 }}>
                <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
                  {adviceFor(totals.present, totals.held, settings.target).text}
                </div>
                {pct !== null && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--ink-3)", marginBottom: 6 }}>
                      <span className="mono">0%</span>
                      <span className="mono">{settings.target}% target</span>
                      <span className="mono">100%</span>
                    </div>
                    <ProgressBar
                      value={pct}
                      color={risk === "ok" ? "var(--accent)" : risk === "warn" ? "var(--warn)" : "var(--danger)"}
                    />
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <div className="grid c2">
            <Card>
              <CardHead title="Weekly load" sub="sessions per weekday" />
              <CardBody style={{ paddingBottom: 10 }}>
                <Bars
                  data={load.map((l) => ({ label: l.day.slice(0, 3), value: l.count }))}
                  height={112}
                  unit="sessions"
                  max={Math.max(6, ...load.map((l) => l.count))}
                />
                <div className="hint" style={{ textAlign: "center" }}>
                  {load.reduce((n, l) => n + l.count, 0)} sessions per week
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHead title="Key dates" />
              <CardBody>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                      Term effective
                    </div>
                    <div style={{ fontSize: 14 }}>{META.effectiveFrom}</div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                      Lunch break
                    </div>
                    <div style={{ fontSize: 14 }}>{LUNCH.time}</div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                      Days submitted
                    </div>
                    <div style={{ fontSize: 14 }}>
                      {Object.keys(locks).length} locked
                      {Object.keys(locks).length > 0 && (
                        <span style={{ color: "var(--ink-3)" }}> · faculty unlock to edit</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                      Next exam
                    </div>
                    <div style={{ fontSize: 14 }}>
                      {examIn === null ? (
                        <Link to="/settings" style={{ fontSize: 13 }}>
                          Set a date in Settings
                        </Link>
                      ) : examIn >= 0 ? (
                        <>
                          <b className="tnum">{examIn}</b> day{examIn === 1 ? "" : "s"} to go
                          <span style={{ color: "var(--ink-3)" }}> · {settings.examDate}</span>
                        </>
                      ) : (
                        "Passed"
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <Card>
        <CardHead
          title="Subjects at a glance"
          sub={atRisk.length ? `${atRisk.length} below target` : "All subjects above target"}
          actions={
            <Link to="/subjects" className="btn sm">
              Details
            </Link>
          }
        />
        <CardBody style={{ display: "grid", gap: 12 }}>
          {Object.values(SUBJECTS).map((s) => {
            const tally = totals.per[s.code];
            const held = subjectHeld(tally);
            const p = percentage(tally?.present ?? 0, held);
            const r = riskOf(p, settings.target);
            return (
              <div key={s.code} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="mono" style={{ width: 78, fontSize: 11, color: `var(${s.hue})` }}>
                  {s.code}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.short}
                </span>
                <div style={{ width: 130, flex: "none" }}>
                  <ProgressBar value={p ?? 0} color={r === "ok" ? "var(--accent)" : r === "warn" ? "var(--warn)" : r === "bad" ? "var(--danger)" : "var(--ink-3)"} />
                </div>
                <span className="mono tnum" style={{ width: 54, textAlign: "right", fontSize: 12.5 }}>
                  {p === null ? "—" : `${p.toFixed(1)}%`}
                </span>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: "var(--ink-3)", fontSize: 12 }}>
        <span>
          Source: {META.department} timetable · {META.term} · effective {META.effectiveFrom}
        </span>
        <span className="mono">
          tomorrow: {asDayName(addDays(now, 1)) ?? "weekend"}
        </span>
      </div>
    </>
  );
}
