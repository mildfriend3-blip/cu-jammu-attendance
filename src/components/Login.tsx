import { useState, type FormEvent } from "react";
import { META } from "../data/timetable";
import { useStudent } from "../state/StudentContext";

export default function Login() {
  const { saved, signIn } = useStudent();
  const [roll, setRoll] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = signIn(roll, name);
    setError(result.ok ? null : result.message ?? "Could not sign in.");
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand">CU Jammu · CSE &amp; CSIT</div>
        <h1>Attendance Portal</h1>
        <p className="lede">
          {META.programme} — {META.semester}. Sign in with your roll number to track your own attendance.
        </p>

        <form onSubmit={submit}>
          <label className="f" htmlFor="roll">Roll number</label>
          <input
            id="roll"
            className="t mono"
            placeholder="e.g. CUJ/CS/2026/001"
            autoComplete="off"
            spellCheck={false}
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
          />

          <label className="f" htmlFor="name">Your name</label>
          <input
            id="name"
            className="t"
            placeholder="e.g. Aarav Sharma"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button className="btn primary wide" type="submit">Sign in</button>
        </form>

        {error && <div className="error-msg">{error}</div>}

        <p className="hint">
          First time here? Your name is saved alongside the roll number so your record appears next time.
        </p>

        {saved.length > 0 && (
          <div className="saved-list">
            <div className="lbl">Continue as</div>
            {saved.map((record) => (
              <button
                key={record.roll}
                type="button"
                className="who"
                onClick={() => signIn(record.roll, "")}
              >
                <span className="avatar">{record.name.charAt(0).toUpperCase()}</span>
                <span>
                  <span className="nm">{record.name}</span>
                  <span className="rl">{record.roll}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="hint ruled">
          Unofficial student tool. Records are kept only in this browser on this device — nothing is
          uploaded, and there is no password. Don&apos;t use it as an official attendance record.
        </p>
      </div>
    </div>
  );
}
