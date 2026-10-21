import { useEffect } from "react";
import { META, SLOTS, SUBJECTS, TT } from "../data/timetable";
import { percentage, subjectShort } from "../lib/attendance";
import { asDayName, minutesOf } from "../lib/date";
import type { Settings, Totals } from "../types";
import { useClock } from "./useClock";

type Notify = (key: string, title: string, body: string) => boolean;

/**
 * Fires the two local notifications: a low-attendance warning and a
 * before-class reminder. `notify` dedupes by key, so each alert lands once per
 * session. The reminder re-checks on a timer, otherwise it would only ever be
 * evaluated when settings changed and would miss the moment it is meant to catch.
 */
export function useAttendanceAlerts(totals: Totals, settings: Settings, notify: Notify): void {
  const now = useClock(60_000);
  const pct = percentage(totals.present, totals.held);

  useEffect(() => {
    if (!settings.notifyLowAttendance || pct === null || pct >= settings.target) return;
    const short = Object.values(SUBJECTS)
      .filter((s) => {
        const tally = totals.per[s.code];
        const held = tally ? tally.present + tally.absent : 0;
        return held > 0 && (tally.present * 100) / held < settings.target;
      })
      .map((s) => s.short);
    notify(
      "low-attendance",
      "Attendance below target",
      short.length
        ? `${pct.toFixed(1)}% overall. Short in ${short.join(", ")}.`
        : `Overall attendance is ${pct.toFixed(1)}%, below your ${settings.target}% target.`,
    );
  }, [notify, pct, settings.notifyLowAttendance, settings.target, totals.per]);

  useEffect(() => {
    if (!settings.notifyClassReminder) return;
    const day = asDayName(now);
    if (!day) return;
    const mins = now.getHours() * 60 + now.getMinutes();
    for (const slot of SLOTS) {
      const code = TT[day][slot.key];
      if (!code) continue;
      const delta = minutesOf(slot.time.split("–")[0]) - mins;
      if (delta > 0 && delta <= settings.reminderLeadMinutes) {
        notify(
          `class-${day}-${slot.key}`,
          "Class starting soon",
          `${subjectShort(code)} at ${slot.time} (${META.room}).`,
        );
        return;
      }
    }
  }, [notify, now, settings.notifyClassReminder, settings.reminderLeadMinutes]);
}
