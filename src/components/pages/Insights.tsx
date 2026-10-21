import { useMemo } from "react";
import { SUBJECTS } from "../../data/timetable";
import {
  classesNeededToTarget,
  dailySeries,
  daysMarked,
  heatmap,
  presentStreak,
  projectAfterAttending,
  rollingRate,
} from "../../lib/analytics";
import { percentage, riskOf, subjectHeld } from "../../lib/attendance";
import { shortDate } from "../../lib/date";
import { useAttendance } from "../../state/AttendanceContext";
import { Badge, Button, Card, CardBody, CardHead, EmptyState, Stat } from "../ui";
import { Bars, Heatmap, Ring } from "../ui/charts";
import { Icon } from "../ui/icons";

export default function Insights() {
  const { log, totals, settings } = useAttendance();

  const series = useMemo(() => dailySeries(log, 14), [log]);
  const cells = useMemo(() => heatmap(log, 14), [log]);
  const rate30 = rollingRate(log, 30);
  const rate7 = rollingRate(log, 7);
  const streak = presentStreak(log);
  const marked = daysMarked(log);

  const pct = percentage(totals.present, totals.held);
  const need = classesNeededToTarget(totals.present, totals.held, settings.target);
  const after5 = projectAfterAttending(totals.present, totals.held, 5);

  const bars = series.map((p) => ({
    label: shortDate(new Date(`${p.date}T00:00:00`)),
    value: p.rate,
    bad: p.rate !== null && p.rate < settings.target,
  }));

  const subjectBars = Object.values(SUBJECTS).map((s) => {
    const tally = totals.per[s.code];
    const held = subjectHeld(tally);
    const p = percentage(tally?.present ?? 0, held);
    return { label: s.short.length > 6 ? `${s.short.slice(0, 5)}…` : s.short, value: p, bad: p !== null && p < settings.target };
  });

  if (totals.held === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Insights</h1>
            <div className="sub">Trends, streaks and projections once you have some data.</div>
          </div>
        </div>
        <Card>
          <EmptyState
            icon="trend"
            title="No attendance data yet"
            body="Mark a few classes and this page fills with a heatmap, daily trend, streak tracking and projections."
            action={
              <a className="btn solid" href="#/attendance">
                <Icon name="checkCircle" size={16} /> Mark attendance
              </a>
            }
          />
        </Card>
      </>
    );
  }

  const risk = riskOf(pct, settings.target);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <div className="sub">Rolling rates, per-day trend, and how the rest of term could play out.</div>
        </div>
        <div className="actions">
          <Badge tone={risk === "ok" ? "ok" : risk === "warn" ? "warn" : "bad"} dot>
            {pct === null ? "no data" : `${pct.toFixed(1)}% overall`}
          </Badge>
        </div>
      </div>

      <div className="grid c4" style={{ marginBottom: 14 }}>
        <Stat label="Last 7 days" value={rate7 === null ? "—" : rate7.toFixed(1)} unit="%" icon="trend" />
        <Stat label="Last 30 days" value={rate30 === null ? "—" : rate30.toFixed(1)} unit="%" icon="chart" />
        <Stat label="Present streak" value={streak} icon="flame" detail="consecutive classes attended" />
        <Stat label="Days marked" value={marked} icon="calendar" detail={`${totals.held} classes recorded`} />
      </div>

      <div className="grid c2" style={{ marginBottom: 14 }}>
        <Card>
          <CardHead title="Daily attendance rate" sub="Trailing 14 days · dashed line is your target" />
          <CardBody>
            <Bars data={bars} height={150} target={settings.target} unit="percent" />
            <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11.5, color: "var(--ink-3)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} /> at or above target
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i style={{ width: 10, height: 10, borderRadius: 2, background: "var(--danger)", display: "inline-block" }} /> below target
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Subject comparison" sub="Lifetime rate per subject" />
          <CardBody>
            <Bars data={subjectBars} height={150} target={settings.target} unit="percent" />
          </CardBody>
        </Card>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <CardHead title="Attendance calendar" sub="Last 14 weeks · darker means more classes attended" />
        <CardBody>
          <Heatmap cells={cells} />
        </CardBody>
      </Card>

      <div className="grid c2">
        <Card>
          <CardHead title="Where you stand" />
          <CardBody style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <Ring value={pct} size={104} color={risk === "ok" ? "var(--accent)" : risk === "warn" ? "var(--warn)" : "var(--danger)"} />
            <div style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
              <div>
                <b style={{ color: "var(--ink)" }}>{totals.present}</b> present out of{" "}
                <b style={{ color: "var(--ink)" }}>{totals.held}</b> classes held.
              </div>
              <div style={{ marginTop: 8 }}>
                {need > 0 ? (
                  <>
                    Attend the next <b style={{ color: "var(--danger)" }}>{need}</b> class{need === 1 ? "" : "es"} in a row
                    to reach {settings.target}%.
                  </>
                ) : (
                  <>You are above target — {totals.held ? "keep the streak going." : ""}</>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Projection" sub="If you attend the next 5 classes" />
          <CardBody>
            <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <Ring value={after5} size={104} color="var(--info)" caption="projected" />
              <div style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
                <div>
                  Currently <b style={{ color: "var(--ink)" }}>{pct === null ? "—" : `${pct.toFixed(1)}%`}</b> → projected{" "}
                  <b style={{ color: "var(--info)" }}>{after5 === null ? "—" : `${after5.toFixed(1)}%`}</b>.
                </div>
                <div style={{ marginTop: 8 }}>
                  {after5 !== null && after5 >= settings.target
                    ? "Five clean classes would put you back over target."
                    : "Five classes alone will not be enough — you will need a longer run."}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  style={{ marginTop: 12 }}
                  onClick={() => window.print()}
                  icon="printer"
                >
                  Print this report
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
