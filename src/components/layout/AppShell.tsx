import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { META } from "../../data/timetable";
import { useHotkeys } from "../../hooks/useHotkeys";
import { useAttendanceAlerts } from "../../hooks/useAttendanceAlerts";
import { useNotifications } from "../../hooks/useNotifications";
import { useTheme } from "../../hooks/useTheme";
import { useAttendance } from "../../state/AttendanceContext";
import { useAuth } from "../../state/AuthContext";
import { Avatar, Toaster } from "../ui";
import { Icon, Logo } from "../ui/icons";
import { CommandPalette } from "./CommandPalette";

interface NavEntry {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV: NavEntry[] = [
  { to: "/", label: "Overview", icon: "dashboard", end: true },
  { to: "/timetable", label: "Timetable", icon: "calendar" },
  { to: "/attendance", label: "Mark attendance", icon: "checkCircle" },
  { to: "/subjects", label: "Subjects", icon: "book" },
  { to: "/insights", label: "Insights", icon: "trend" },
  { to: "/history", label: "History", icon: "clock" },
  { to: "/admin", label: "Faculty console", icon: "users" },
  { to: "/settings", label: "Settings", icon: "settings" },
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

  useAttendanceAlerts(totals, settings, notify);

  if (!account) return null;

  const title = TITLES[location.pathname] ?? META.product;

  return (
    <div className="shell">
      <aside className={`sidebar ${drawerOpen ? "open" : ""}`}>
        <div className="brand">
          <Logo size={26} />
          <div>
            <div className="nm">{META.product}</div>
            <div className="tg">{META.classTag} · {META.semester}</div>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item) => (
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
        </nav>

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
            {META.product} / <b>{title}</b>
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
