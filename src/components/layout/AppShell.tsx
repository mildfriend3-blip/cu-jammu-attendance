import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { META, SLOTS, SUBJECTS, TT } from "../../data/timetable";
import { useHotkeys } from "../../hooks/useHotkeys";
import { useNotifications } from "../../hooks/useNotifications";
import { useTheme } from "../../hooks/useTheme";
import { useAttendance } from "../../state/AttendanceContext";
import { useAuth } from "../../state/AuthContext";
import { percentage, subjectShort } from "../../lib/attendance";
import { asDayName, minutesOf } from "../../lib/date";
import { Avatar, Toaster } from "../ui";
import { Icon, Logo } from "../ui/icons";
import { CommandPalette } from "./CommandPalette";

interface NavEntry {
  to: string;
  label: string;
  icon: string;
  group: string;
  end?: boolean;
}

const NAV: NavEntry[] = [
  { to: "/", label: "Overview", icon: "dashboard", group: "Operations", end: true },
  { to: "/timetable", label: "Timetable", icon: "calendar", group: "Operations" },
  { to: "/attendance", label: "Mark attendance", icon: "checkCircle", group: "Operations" },
  { to: "/subjects", label: "Subjects", icon: "book", group: "Analysis" },
  { to: "/insights", label: "Insights", icon: "trend", group: "Analysis" },
  { to: "/history", label: "History", icon: "clock", group: "Analysis" },
  { to: "/admin", label: "Faculty console", icon: "users", group: "Administration" },
  { to: "/settings", label: "Settings", icon: "settings", group: "Administration" },
];

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/timetable": "Timetable",
  "/attendance": "Mark attendance",
  "/subjects": "Subjects",
  "/insights": "Insights",
  "/history": "History",
  "/admin": "Faculty console",
  "/settings": "Settings",
};

export default function AppShell() {
  const { account, signOut } = useAuth();
  const { totals, settings } = useAttendance();
  const { theme, toggle } = useTheme();
  const { notify } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hotkeys = useMemo(
    () => ({
      "mod+k": () => setPaletteOpen(true),
      "/": () => setPaletteOpen(true),
      "mod+shift+l": () => toggle(),
    }),
    [toggle],
  );
  useHotkeys(hotkeys);

  // Low-attendance alert (once per session) + upcoming-class reminder.
  const pct = percentage(totals.present, totals.held);
  useMemo(() => {
    if (!settings.notifyLowAttendance || pct === null || pct >= settings.target) return;
    const short = Object.values(SUBJECTS)
      .filter((s) => {
        const t = totals.per[s.code];
        const held = t ? t.present + t.absent : 0;
        return held > 0 && (t.present * 100) / held < settings.target;
      })
      .map((s) => s.short);
    notify(
      "low-attendance",
      "Attendance below target",
      short.length
        ? `${pct.toFixed(1)}% overall. Short in: ${short.join(", ")}.`
        : `Overall attendance is ${pct.toFixed(1)}%, below your ${settings.target}% target.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct]);

  useMemo(() => {
    if (!settings.notifyClassReminder) return;
    const now = new Date();
    const day = asDayName(now);
    if (!day) return;
    const mins = now.getHours() * 60 + now.getMinutes();
    for (const slot of SLOTS) {
      const code = TT[day][slot.key];
      if (!code) continue;
      const [start] = slot.time.split("–");
      const delta = minutesOf(start) - mins;
      if (delta > 0 && delta <= settings.reminderLeadMinutes) {
        notify(
          `class-${day}-${slot.key}`,
          "Class starting soon",
          `${subjectShort(code)} at ${slot.time} (${META.room}).`,
        );
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.notifyClassReminder, settings.reminderLeadMinutes]);

  if (!account) return null;

  const groups = Array.from(new Set(NAV.map((n) => n.group)));
  const title = TITLES[location.pathname] ?? "Sentinel";

  return (
    <div className="shell">
      <aside className={`sidebar ${drawerOpen ? "open" : ""}`}>
        <div className="brand">
          <Logo size={26} />
          <div>
            <div className="nm">CU Jammu Sentinel</div>
            <div className="tg">I-CCS · {META.semester}</div>
          </div>
        </div>

        {groups.map((group) => (
          <div className="nav-group" key={group}>
            <div className="lbl">{group}</div>
            {NAV.filter((n) => n.group === group).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                onClick={() => setDrawerOpen(false)}
              >
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}

        <div className="sidebar-foot">
          <div className="whoami">
            <Avatar name={account.name} />
            <div style={{ minWidth: 0 }}>
              <div className="nm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {account.name}
              </div>
              <div className="rl">{account.roll}</div>
            </div>
          </div>
          <button className="nav-item" style={{ width: "100%", background: "none", border: 0, cursor: "pointer" }} onClick={signOut}>
            <Icon name="logout" size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="iconbtn only-mobile" onClick={() => setDrawerOpen((o) => !o)} aria-label="Toggle navigation">
            <Icon name="menu" />
          </button>
          <div className="crumb">
            Sentinel / <b>{title}</b>
          </div>
          <div className="spacer" />
          <button className="searchbtn" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={15} />
            <span className="txt">Search…</span>
            <span className="spacer2" />
            <span className="kbd">⌘K</span>
          </button>
          <button className="iconbtn" onClick={toggle} aria-label="Toggle theme" title="Toggle theme (⌘⇧L)">
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button
            className="iconbtn"
            onClick={() => navigate("/attendance")}
            aria-label="Mark attendance"
            title="Mark attendance"
          >
            <Icon name="checkCircle" />
          </button>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  );
}
