import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./components/auth/AuthPage";
import AppShell from "./components/layout/AppShell";
import AdminConsole from "./components/pages/AdminConsole";
import History from "./components/pages/History";
import Insights from "./components/pages/Insights";
import MarkDay from "./components/pages/MarkDay";
import Overview from "./components/pages/Overview";
import Settings from "./components/pages/Settings";
import Subjects from "./components/pages/Subjects";
import Timetable from "./components/pages/Timetable";
import { Toaster } from "./components/ui";
import { Logo } from "./components/ui/icons";
import { useAuth } from "./state/AuthContext";

function BootSplash() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        gap: 18,
        alignContent: "center",
      }}
    >
      <Logo size={40} />
      <div className="mono" style={{ fontSize: 11.5, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        loading…
      </div>
    </div>
  );
}

export default function App() {
  const { account, booting } = useAuth();

  if (booting) return <BootSplash />;

  if (!account) {
    return (
      <>
        <AuthPage />
        <Toaster />
      </>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Overview />} />
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/attendance" element={<MarkDay />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/history" element={<History />} />
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
