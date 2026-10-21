import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { SUBJECTS } from "../../data/timetable";
import { adviceFor, percentage, riskOf, subjectHeld } from "../../lib/attendance";
import { subjectRate } from "../../lib/analytics";
import { useAttendance } from "../../state/AttendanceContext";
import { Badge, Button, Card, CardBody, CardHead, ProgressBar, Stat } from "../ui";
import { Icon } from "../ui/icons";

export default function Subjects() {
  const { totals, settings, log } = useAttendance();
  const [params, setParams] = useSearchParams();
  const focus = params.get("focus");
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (focus && refs.current[focus]) {
      refs.current[focus]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focus]);

  const rows = Object.values(SUBJECTS).map((subject) => {
    const tally = totals.per[subject.code] ?? { present: 0, absent: 0, cancelled: 0 };
    const held = subjectHeld(tally);
    const pct = percentage(tally.present, held);
    return {
      subject,
      tally,
      held,
      pct,
      risk: riskOf(pct, settings.target),
      advice: adviceFor(tally.present, held, settings.target),
      rate30: subjectRate(log, subject.code, 30),
    };
  });

  const short = rows.filter((r) => r.held > 0 && (r.pct ?? 0) < settings.target);
  const strongest = [...rows].filter((r) => r.held > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Subjects</h1>
          <div className="sub">
            {totals.held
              ? `${totals.present} present · ${totals.absent} absent across ${totals.held} held classes · target ${settings.target}%`
              : "Nothing marked yet — start from Mark attendance."}
          </div>
        </div>
      </div>

      <div className="grid c4" style={{ marginBottom: 14 }}>
        <Stat label="Subjects tracked" value={rows.length} icon="book" />
        <Stat label="Below target" value={short.length} icon="alert" accent={short.length > 0} />
        <Stat
          label="Strongest"
          value={strongest ? strongest.subject.short : "—"}
          icon="trend"
          detail={strongest ? `${(strongest.pct ?? 0).toFixed(1)}% over ${strongest.held} classes` : "no data"}
        />
        <Stat
          label="Total cancelled"
          value={totals.cancelled}
          icon="close"
          detail="excluded from percentages"
        />
      </div>

      {short.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <CardBody style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Icon name="alert" size={20} style={{ color: "var(--danger)" }} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 600 }}>Below your {settings.target}% target</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
                {short.map((r) => r.subject.short).join(" · ")}
              </div>
            </div>
            {focus && (
              <Button size="sm" variant="ghost" onClick={() => setParams({}, { replace: true })}>
                Clear focus
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid c2">
        {rows.map(({ subject, tally, held, pct, risk, advice, rate30 }) => (
          <div
            key={subject.code}
            ref={(el) => {
              refs.current[subject.code] = el;
            }}
            className="scard"
            style={{
              ["--sc" as string]: `var(${subject.hue})`,
              outline: focus === subject.code ? "2px solid var(--line-accent)" : undefined,
            }}
          >
            <div className="top">
              <div style={{ minWidth: 0 }}>
                <div className="cc mono">{subject.code}</div>
                <div className="cn">{subject.name}</div>
                <div className="cf">{subject.faculty}</div>
              </div>
              <div
                className="pv tnum"
                style={{ color: risk === "ok" ? "var(--accent)" : risk === "warn" ? "var(--warn)" : risk === "bad" ? "var(--danger)" : "var(--ink-3)" }}
              >
                {pct === null ? "—" : `${pct.toFixed(1)}%`}
                <small>{held} held</small>
              </div>
            </div>

            <div style={{ marginTop: 13 }}>
              <ProgressBar
                value={pct ?? 0}
                color={risk === "ok" ? "var(--accent)" : risk === "warn" ? "var(--warn)" : risk === "bad" ? "var(--danger)" : "var(--ink-3)"}
              />
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
              {rate30 !== null && (
                <span style={{ marginLeft: "auto" }}>
                  30d <b>{rate30.toFixed(0)}%</b>
                </span>
              )}
            </div>

            <div className={`verdict ${risk === "none" ? "none" : risk}`}>{advice.text}</div>
          </div>
        ))}
      </div>

      <Card style={{ marginTop: 14 }}>
        <CardHead title="How the numbers work" sub="So you can defend them if asked" />
        <CardBody>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.9 }}>
            <li>
              Percentage = present ÷ (present + absent). <b>Cancelled classes never count</b> toward either side.
            </li>
            <li>Unmarked classes are excluded entirely, so your rate only reflects what you have actually recorded.</li>
            <li>
              “Can miss N” keeps you <b>above</b> target: N = ⌊present ÷ target − held⌋.
            </li>
            <li>
              “Attend N in a row” recovers you: N = ⌈(target × held − present) ÷ (1 − target)⌉.
            </li>
          </ul>
        </CardBody>
      </Card>

      {short.length === 0 && totals.held > 0 && (
        <Card style={{ marginTop: 14 }}>
          <CardBody style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Badge tone="ok" dot>
              all clear
            </Badge>
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Every subject with data is at or above your {settings.target}% target.
            </span>
          </CardBody>
        </Card>
      )}
    </>
  );
}
