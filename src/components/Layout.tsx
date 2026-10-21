import type { CSSProperties } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { computeTotals, percentage } from "../lib/attendance";
import { useTheme } from "../hooks/useTheme";
import { useStudent } from "../state/StudentContext";

const TABS = [
  { to: "/timetable", label: "Timetable" },
  { to: "/today", label: "Mark today" },
  { to: "/subjects", label: "Subjects" },
  { to: "/history", label: "History" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  const { student, toast, signOut } = useStudent();
  const { theme, toggle } = useTheme();

  if (!student) return null;

  const totals = computeTotals(student.log);
  const pct = percentage(totals.present, totals.held);
  const ringColor =
    pct === null
      ? "var(--ink-3)"
      : pct >= student.target
        ? "var(--sage)"
        : pct >= student.target - 10
          ? "var(--amber)"
          : "var(--red)";

  return (
    <div className="app">
      <div className="topbar">
        <div className="me">
          <div className="avatar xl">{student.name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="nm">{student.name}</div>
            <div className="rl">{student.roll}</div>
          </div>
        </div>

        <div className="overall">
          <div
            className="ring"
            style={{ "--ring-p": pct ?? 0, "--ring-c": ringColor } as CSSProperties}
            title={`Target ${student.target}%`}
          >
            <span>{pct === null ? "—" : `${pct.toFixed(1)}%`}</span>
          </div>
          <div>
            <div className="k">Overall</div>
            <div className="v">
              {totals.present} / {totals.held} <small>classes held</small>
            </div>
          </div>
          <button className="btn sm ghost" onClick={toggle} title="Toggle light / dark">
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button className="btn sm ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <nav className="tabs">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
