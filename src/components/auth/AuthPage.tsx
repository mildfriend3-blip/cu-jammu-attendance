import { useMemo, useState, type FormEvent } from "react";
import { META, SLOTS, SUBJECTS } from "../../data/timetable";
import { scorePassword } from "../../lib/crypto";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { Button, Field, Input, Select } from "../ui";
import { Icon, Logo } from "../ui/icons";

type Mode = "login" | "signup";

export default function AuthPage() {
  const { accounts, signIn, signUp } = useAuth();
  const { push } = useToast();

  const [mode, setMode] = useState<Mode>("login");
  const [roll, setRoll] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"student" | "faculty">("student");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  const strength = useMemo(() => scorePassword(password, roll, name), [password, roll, name]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirm("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const res = await signIn(roll, password, remember);
        if (!res.ok) setError({ field: res.field, message: res.message ?? "Could not sign in." });
        else push(`Welcome back, ${roll.toUpperCase()}`, "success");
      } else {
        const res = await signUp({ roll, name, password, confirm, role });
        if (!res.ok) setError({ field: res.field, message: res.message ?? "Could not create account." });
        else push("Account created — you're signed in.", "success");
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  const strengthColors = ["var(--danger)", "var(--danger)", "var(--warn)", "var(--accent)", "var(--accent)"];

  return (
    <div className="auth">
      <section className="auth-brand">
        <div>
          <div className="mark">
            <Logo size={34} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>CU Jammu Sentinel</div>
              <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent)" }}>
                Attendance Intelligence
              </div>
            </div>
          </div>

          <h1>
            Attendance you can
            <br />
            actually trust.
          </h1>
          <p className="lede">
            A local-first console for {META.programme} ({META.semester}) at {META.university}. Track every class,
            watch your percentage in real time, and know exactly how many you can afford to miss.
          </p>

          <div className="term">
            <div>
              <span className="k">$</span> sentinel <b>status</b> --term "{META.term.split(" (")[0]}"
            </div>
            <div>
              <span className="k">›</span> class {META.classTag} · room {META.room}
            </div>
            <div>
              <span className="k">›</span> {Object.keys(SUBJECTS).length} subjects · {SLOTS.length} daily slots
            </div>
            <div>
              <span className="k">›</span> storage <b>local</b> · passwords PBKDF2-SHA256
            </div>
          </div>

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
        </div>

        <p className="hint" style={{ maxWidth: "52ch" }}>
          Unofficial student project. Records never leave this device — there is no server. Passwords are salted and
          hashed with PBKDF2, but a verifier stored in the browser can still be tampered with, so treat this as a
          personal tracker rather than an authoritative record.
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

          <h2>{mode === "login" ? "Sign in to Sentinel" : "Register your roll number"}</h2>
          <p className="blurb">
            {mode === "login"
              ? "Enter the roll number and password you registered with."
              : "One account per roll number and per name on this device."}
          </p>

          <form className="stack" onSubmit={submit}>
            <Field label="Roll number" htmlFor="roll" error={error?.field === "roll" ? error.message : undefined}>
              <Input
                id="roll"
                className="mono"
                placeholder="26BECCS533"
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
                  placeholder="Aarav Sharma"
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
              aside={
                mode === "signup" ? (
                  <span className="mono" style={{ textTransform: "none", letterSpacing: 0, color: strengthColors[strength.score] }}>
                    {password ? strength.label : ""}
                  </span>
                ) : undefined
              }
            >
              <div className="pw-wrap">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  invalid={error?.field === "password"}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  <Icon name={showPw ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
            </Field>

            {mode === "signup" && (
              <>
                <div className="strength">
                  <div className="track">
                    {[0, 1, 2, 3].map((i) => (
                      <i key={i} style={{ background: i < strength.score ? strengthColors[strength.score] : undefined }} />
                    ))}
                  </div>
                  <div className="lbl">{strength.score >= 3 ? "strong" : strength.score >= 2 ? "ok" : "weak"}</div>
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
              {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {accounts.length > 0 && (
            <div className="accounts">
              <div className="lbl">Registered on this device</div>
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
                    <span className="rl">{a.roll}{a.role === "faculty" ? " · faculty" : ""}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
