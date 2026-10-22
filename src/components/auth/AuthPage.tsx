import { useMemo, useState, type FormEvent } from "react";
import { META, SLOTS, SUBJECTS } from "../../data/timetable";
import { scorePassword } from "../../lib/crypto";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { Button, Field, Input, Select } from "../ui";
import ForgotPassword from "./ForgotPassword";
import { Icon, Logo } from "../ui/icons";

type Mode = "login" | "signup";

const STRENGTH_COLOURS = [
  "var(--danger)",
  "var(--danger)",
  "var(--warn)",
  "var(--accent)",
  "var(--accent)",
];

export default function AuthPage() {
  const { accounts, signIn, signUp } = useAuth();
  const { push } = useToast();

  const [mode, setMode] = useState<Mode>("login");
  const [roll, setRoll] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [role, setRole] = useState<"student" | "faculty">("student");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  const strength = useMemo(() => scorePassword(password, roll, name), [password, roll, name]);

  const passwordHint = useMemo(() => {
    if (mode !== "signup" || !password || strength.warnings.length === 0) return undefined;
    return `This password ${strength.warnings.join(" and ")}. You can still use it.`;
  }, [mode, password, strength]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirm("");
    setRecoveryCode("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const result = await signIn(roll, password, remember);
        if (!result.ok) setError({ field: result.field, message: result.message ?? "Could not sign in." });
      } else {
        const result = await signUp({ roll, name, password, confirm, role, recoveryCode });
        if (!result.ok) setError({ field: result.field, message: result.message ?? "Could not create account." });
        else push("Account created", "success");
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-brand">
        <div>
          <div className="mark">
            <Logo size={32} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{META.product}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                {META.programme} · {META.semester}
              </div>
            </div>
          </div>

          <h1 style={{ fontSize: "clamp(24px, 2.6vw, 32px)", margin: "30px 0 12px" }}>
            Track your attendance, week by week
          </h1>
          <p className="lede">
            Mark each class, watch your percentage against the department target, and see exactly how many you can
            still afford to miss. Everything is stored on this device — there is no server.
          </p>

          <div className="auth-facts">
            <div className="auth-fact">
              <div className="k">Subjects</div>
              <div className="v tnum">{Object.keys(SUBJECTS).length}</div>
            </div>
            <div className="auth-fact">
              <div className="k">Daily slots</div>
              <div className="v tnum">{SLOTS.length}</div>
            </div>
            <div className="auth-fact">
              <div className="k">Accounts here</div>
              <div className="v tnum">{accounts.length}</div>
            </div>
          </div>

          <dl style={{ marginTop: 30, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 13 }}>
            <dt style={{ color: "var(--ink-3)" }}>Department</dt>
            <dd style={{ margin: 0 }}>{META.department}</dd>
            <dt style={{ color: "var(--ink-3)" }}>Class</dt>
            <dd style={{ margin: 0 }}>
              {META.classTag} · room {META.room}
            </dd>
            <dt style={{ color: "var(--ink-3)" }}>Term</dt>
            <dd style={{ margin: 0 }}>{META.term}</dd>
          </dl>
        </div>

        <p className="hint" style={{ maxWidth: "54ch" }}>
          Unofficial student project, not an official record. Passwords are salted and hashed with PBKDF2, but the
          verifier is kept in this browser, so someone with the device could still tamper with it.
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-form">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => switchMode("login")}>
              Sign in
            </button>
            <button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "on" : ""} onClick={() => switchMode("signup")}>
              Create account
            </button>
          </div>

          <h2>{mode === "login" ? "Sign in" : "Create your account"}</h2>
          <p className="blurb">
            {mode === "login"
              ? "Use the roll number and password you registered with."
              : "One account per roll number and per name on this device."}
          </p>

          <form className="stack" onSubmit={submit}>
            <Field label="Roll number" htmlFor="roll" error={error?.field === "roll" ? error.message : undefined}>
              <Input
                id="roll"
                className="mono"
                placeholder="e.g. 26BECCS533"
                autoComplete="username"
                spellCheck={false}
                value={roll}
                invalid={error?.field === "roll"}
                onChange={(e) => setRoll(e.target.value.toUpperCase())}
              />
            </Field>

            {mode === "signup" && (
              <Field label="Full name" htmlFor="name" error={error?.field === "name" ? error.message : undefined}>
                <Input
                  id="name"
                  placeholder="Your full name"
                  autoComplete="name"
                  value={name}
                  invalid={error?.field === "name"}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            )}

            <Field
              label="Password"
              htmlFor="password"
              error={error?.field === "password" ? error.message : undefined}
              hint={passwordHint}
            >
              <div className="pw-wrap">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  invalid={error?.field === "password"}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
            </Field>

            {mode === "login" && (
              <div style={{ textAlign: "right", marginTop: -6 }}>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  style={{ background: "none", border: 0, padding: 0, color: "var(--accent)", fontSize: 13, cursor: "pointer" }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {mode === "signup" && (
              <>
                <div className="strength">
                  <div className="track">
                    {[0, 1, 2, 3].map((i) => (
                      <i key={i} style={{ background: i < strength.score ? STRENGTH_COLOURS[strength.score] : undefined }} />
                    ))}
                  </div>
                  <div className="lbl">{password ? strength.label : ""}</div>
                </div>

                <Field label="Confirm password" htmlFor="confirm">
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={confirm}
                    invalid={Boolean(confirm) && confirm !== password}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </Field>

                <Field
                  label="Recovery code (optional)"
                  htmlFor="recovery"
                  error={error?.field === "recovery" ? error.message : undefined}
                  hint="Save this somewhere safe. It is the only way to reset your own password without help."
                >
                  <Input
                    id="recovery"
                    className="mono"
                    placeholder="e.g. K7RM-3QPZ-9TFH"
                    autoComplete="off"
                    spellCheck={false}
                    value={recoveryCode}
                    invalid={error?.field === "recovery"}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  />
                </Field>

                <Field label="Account type" htmlFor="role" hint="Faculty accounts unlock the class-wide console.">
                  <Select id="role" value={role} onChange={(e) => setRole(e.target.value as "student" | "faculty")}>
                    <option value="student">Student</option>
                    <option value="faculty">Faculty / staff</option>
                  </Select>
                </Field>
              </>
            )}

            {mode === "login" && (
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--ink-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Keep me signed in on this device
              </label>
            )}

            {error && !error.field && (
              <div className="err" role="alert">
                <Icon name="alert" size={13} style={{ marginTop: 2, flex: "none" }} />
                <span>{error.message}</span>
              </div>
            )}

            <Button type="submit" variant="solid" size="lg" block disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {accounts.length > 0 && (
            <div className="accounts">
              <div className="lbl">Already registered on this device</div>
              {accounts.slice(0, 4).map((a) => (
                <button
                  key={a.roll}
                  type="button"
                  className="account"
                  onClick={() => {
                    setMode("login");
                    setRoll(a.roll);
                    setPassword("");
                    setError(null);
                  }}
                >
                  <span className="avatar">
                    {a.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="nm" style={{ display: "block" }}>{a.name}</span>
                    <span className="rl">
                      {a.roll}
                      {a.role === "faculty" ? " · faculty" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {forgotOpen && (
        <ForgotPassword
          initialRoll={roll}
          onClose={() => setForgotOpen(false)}
          onReset={(resetRoll) => {
            setForgotOpen(false);
            setMode("login");
            setRoll(resetRoll);
            setPassword("");
            setError(null);
          }}
        />
      )}
    </div>
  );
}
