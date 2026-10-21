import { useRef, useState } from "react";
import { META } from "../../data/timetable";
import { percentage } from "../../lib/attendance";
import { attendanceLogCSV, downloadFile, subjectSummaryCSV } from "../../lib/export";
import { loadFacultyPasscode, saveFacultyPasscode } from "../../lib/storage";
import { useNotifications } from "../../hooks/useNotifications";
import { useTheme } from "../../hooks/useTheme";
import { useAttendance } from "../../state/AttendanceContext";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { Avatar, Badge, Button, Card, CardBody, CardHead, Field, Input, Segmented } from "../ui";
import { Icon } from "../ui/icons";
import type { Settings as SettingsModel, Status } from "../../types";

export default function Settings() {
  const { account, signOut } = useAuth();
  const { settings, updateSettings, totals, log, erase, replaceLog, exportBackup } = useAttendance();
  const { theme, setTheme } = useTheme();
  const { permission, request } = useNotifications();
  const { push } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const [targetDraft, setTargetDraft] = useState(String(settings.target));
  const [examDraft, setExamDraft] = useState(settings.examDate ?? "");
  const [passcode, setPasscode] = useState("");
  const [confirmText, setConfirmText] = useState("");

  if (!account) return null;

  const pct = percentage(totals.present, totals.held);

  function saveTarget() {
    const value = Number.parseInt(targetDraft, 10);
    if (Number.isNaN(value) || value < 1 || value > 100) {
      push("Target must be between 1 and 100", "error");
      return;
    }
    updateSettings({ target: value });
    push(`Target set to ${value}%`, "success");
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          roll?: string;
          settings?: Partial<SettingsModel>;
          log?: Record<string, Status>;
        };
        if (!parsed || typeof parsed.log !== "object" || !parsed.log) throw new Error("bad shape");
        replaceLog(parsed.log);
        if (parsed.settings) updateSettings(parsed.settings);
        push(`Imported ${Object.keys(parsed.log).length} records`, "success");
      } catch {
        push("That file is not a Sentinel backup", "error");
      }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">Account, targets, alerts, data and the faculty gate.</div>
        </div>
      </div>

      <div className="grid c2" style={{ marginBottom: 14 }}>
        <Card>
          <CardHead title="Account" sub="Stored locally on this device only" />
          <CardBody>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Avatar name={account.name} size="xl" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{account.name}</div>
                <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{account.roll}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge tone={account.role === "faculty" ? "info" : "neutral"}>{account.role}</Badge>
                  <Badge tone={pct === null ? "neutral" : pct >= settings.target ? "ok" : "bad"}>
                    {pct === null ? "no data" : `${pct.toFixed(1)}% overall`}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="divider" style={{ borderTop: "1px solid var(--line)", margin: "18px 0" }} />

            <div style={{ display: "grid", gap: 12 }}>
              <Row label="Registered" value={new Date(account.createdAt).toLocaleDateString("en-IN")} />
              <Row label="Last active" value={new Date(account.lastSeenAt).toLocaleString("en-IN")} />
              <Row label="Classes recorded" value={String(totals.held + totals.cancelled)} />
            </div>

            <Button variant="ghost" icon="logout" style={{ marginTop: 18 }} onClick={signOut}>
              Sign out of this device
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Attendance target" sub="Drives every verdict, alert and projection" />
          <CardBody>
            <Field label="Required attendance (%)" htmlFor="target">
              <Input
                id="target"
                className="mono"
                type="number"
                min={1}
                max={100}
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
              />
            </Field>
            <Button variant="solid" style={{ marginTop: 14 }} icon="check" onClick={saveTarget}>
              Save target
            </Button>

            <div className="divider" style={{ borderTop: "1px solid var(--line)", margin: "20px 0" }} />

            <Field label="Next exam date" htmlFor="exam" hint="Shows a countdown on the overview.">
              <input
                id="exam"
                type="date"
                className="input mono"
                value={examDraft}
                onChange={(e) => {
                  setExamDraft(e.target.value);
                  updateSettings({ examDate: e.target.value || null });
                }}
              />
            </Field>
          </CardBody>
        </Card>
      </div>

      <div className="grid c2" style={{ marginBottom: 14 }}>
        <Card>
          <CardHead title="Appearance" />
          <CardBody>
            <Field label="Theme">
              <Segmented<"dark" | "light">
                value={theme}
                label="Theme"
                onChange={setTheme}
                options={[
                  { value: "dark", label: "Sentinel (dark)" },
                  { value: "light", label: "Daylight (light)" },
                ]}
              />
            </Field>
            <div className="hint" style={{ marginTop: 12 }}>
              Keyboard shortcuts: <span className="kbd">⌘K</span> command palette · <span className="kbd">/</span> search ·{" "}
              <span className="kbd">⌘⇧L</span> toggle theme
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Alerts" sub="Local notifications while the app is open" />
          <CardBody>
            <div style={{ display: "grid", gap: 14 }}>
              <Toggle
                label="Warn me when a subject drops below target"
                checked={settings.notifyLowAttendance}
                onChange={(v) => updateSettings({ notifyLowAttendance: v })}
              />
              <Toggle
                label="Remind me before a class starts"
                checked={settings.notifyClassReminder}
                onChange={(v) => updateSettings({ notifyClassReminder: v })}
              />
              <Field label="Reminder lead time (minutes)" htmlFor="lead">
                <Input
                  id="lead"
                  className="mono"
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  value={settings.reminderLeadMinutes}
                  onChange={(e) => updateSettings({ reminderLeadMinutes: Math.max(5, Number(e.target.value) || 15) })}
                />
              </Field>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Badge tone={permission === "granted" ? "ok" : permission === "denied" ? "bad" : "neutral"}>
                  permission: {permission}
                </Badge>
                {permission !== "granted" && permission !== "unsupported" && (
                  <Button size="sm" icon="bell" onClick={() => void request()}>
                    Enable notifications
                  </Button>
                )}
              </div>

              <div className="hint">
                <Icon name="info" size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                Without a server there is no push delivery — alerts fire while this tab is open. Add the app to your
                home screen and keep it backgrounded for best results.
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <CardHead title="Data" sub="Backups, exports and the faculty gate" />
        <CardBody>
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <Button icon="download" onClick={() => { exportBackup(); push("Backup downloaded", "success"); }}>
              Export backup (JSON)
            </Button>
            <Button icon="upload" onClick={() => fileRef.current?.click()}>
              Import backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hide"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importBackup(file);
                e.target.value = "";
              }}
            />
            <Button
              icon="download"
              onClick={() => {
                downloadFile(`sentinel-log-${account.roll}.csv`, attendanceLogCSV(account.roll, account.name, log), "text/csv;charset=utf-8");
                push("Log exported", "success");
              }}
            >
              Export log (CSV)
            </Button>
            <Button
              icon="download"
              onClick={() => {
                downloadFile(
                  `sentinel-summary-${account.roll}.csv`,
                  subjectSummaryCSV(account.roll, account.name, log, settings.target),
                  "text/csv;charset=utf-8",
                );
                push("Summary exported", "success");
              }}
            >
              Subject summary (CSV)
            </Button>
          </div>

          <div className="divider" style={{ borderTop: "1px solid var(--line)", margin: "20px 0" }} />

          <Field
            label="Faculty console passcode"
            htmlFor="pc"
            hint={`Current passcode is stored in this browser. Default is "sentinel".`}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                id="pc"
                className="mono"
                type="text"
                placeholder="new passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
              />
              <Button
                variant="solid"
                icon="key"
                onClick={() => {
                  if (passcode.trim().length < 4) {
                    push("Use at least 4 characters", "error");
                    return;
                  }
                  saveFacultyPasscode(passcode.trim());
                  setPasscode("");
                  push("Faculty passcode updated", "success");
                }}
              >
                Update
              </Button>
            </div>
          </Field>
          <div className="hint" style={{ marginTop: 8 }}>
            Active passcode: <span className="mono">{loadFacultyPasscode().replace(/./g, "•")}</span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Danger zone" sub="These actions cannot be undone" />
        <CardBody>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Input
              placeholder={`type ${account.roll} to confirm`}
              className="mono"
              style={{ maxWidth: 260 }}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <Button
              variant="danger"
              icon="trash"
              disabled={confirmText.trim().toUpperCase() !== account.roll}
              onClick={() => {
                erase();
                setConfirmText("");
                push("Attendance erased", "success");
              }}
            >
              Erase my attendance
            </Button>
          </div>
          <div className="hint" style={{ marginTop: 10 }}>
            Clears every marked class for {account.roll}. Your account and password stay intact.
          </div>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <CardHead title="About" />
        <CardBody>
          <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.8 }}>
            <div>
              <b style={{ color: "var(--ink)" }}>CU Jammu Sentinel</b> v{META.version} — an unofficial attendance
              console for {META.programme} ({META.semester}), {META.department}, {META.university}.
            </div>
            <div style={{ marginTop: 8 }}>
              Built on the department timetable for the {META.term}, effective {META.effectiveFrom}. No backend, no
              analytics, no tracking — every record stays in this browser.
            </div>
            <div style={{ marginTop: 8 }}>
              Passwords are salted and hashed with PBKDF2-HMAC-SHA256 (210,000 iterations). That is real key
              derivation, but because the verifier is stored locally a determined user with this device could still
              tamper with it. Treat Sentinel as a personal tracker, not an authoritative attendance record.
            </div>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
      <span style={{ color: "var(--ink-3)" }}>{label}</span>
      <span className="mono tnum" style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13.5, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
