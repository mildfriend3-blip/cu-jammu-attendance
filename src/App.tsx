import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./components/Login";
import TimetableView from "./components/TimetableView";
import TodayView from "./components/TodayView";
import SubjectsView from "./components/SubjectsView";
import HistoryView from "./components/HistoryView";
import SettingsView from "./components/SettingsView";
import { useStudent } from "./state/StudentContext";

export default function App() {
  const { student } = useStudent();

  if (!student) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/timetable" replace />} />
        <Route path="/timetable" element={<TimetableView />} />
        <Route path="/today" element={<TodayView />} />
        <Route path="/subjects" element={<SubjectsView />} />
        <Route path="/history" element={<HistoryView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/timetable" replace />} />
      </Route>
    </Routes>
  );
}
