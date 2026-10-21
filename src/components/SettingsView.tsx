import { useRef, useState } from "react";
import { META } from "../data/timetable";
import { useStudent } from "../state/StudentContext";
import type { StudentRecord } from "../types";

export default function SettingsView() {
  const { student, setTarget, eraseLog, importRecord, signOut, showToast } = useStudent();
  const fileInput = useRef<HTMLInputElement>(null);
  const [targetDraft, setTargetDraft] = useState(() => String(student?.target ?? 75));

  if (!student) return null;
  const record: StudentRecord = student;

  function saveTarget() {
    const value = Number.parseInt(targetDraft, 10);
    if (Number.isNaN(value) || value < 1 || value > 100) {
      showToast("Enter a value between 1 and 100");
      return;
    }
    setTarget(value);
    showToast(`Target set to ${value}%`);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_${record.roll.replace(/[^A-Za-z0-9]+/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded");
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as StudentRecord;
        if (!parsed?.roll || typeof parsed.log !== "object") throw new Error("bad shape");
        importRecord(parsed);
        setTargetDraft(String(parsed.target ?? 75));
        showToast("Backup imported");
      } catch {
        showToast("That file doesn't look like a backup");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="panel">
      <div className="card">
        <h2>Attendance target</h2>
        <p className="sub">
          Most departments require 75%. Set whatever your department enforces — the subject verdicts use it.
        </p>
        <div className="set-row">
          <div className="grow">
            <label className="f" htmlFor="target">Required attendance (%)</label>
            <input
              id="target"
              className="t mono"
              type="number"
              min={1}
              max={100}
              step={1}
              value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value)}
            />
          </div>
          <button className="btn primary" onClick={saveTarget}>Save</button>
        </div>

        <div className="divider" />

        <h2>Your data</h2>
        <p className="sub">
          Records live in this browser only. Export a backup before clearing browser data or switching devices.
        </p>
        <div className="rowbtns">
          <button className="btn" onClick={exportBackup}>Export backup (.json)</button>
          <button className="btn" onClick={() => fileInput.current?.click()}>Import backup</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hide"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button className="btn" onClick={signOut}>Switch student</button>
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm(`Erase all attendance marked for ${record.roll}? This cannot be undone.`)) {
                eraseLog();
                showToast("Attendance erased");
              }
            }}
          >
            Erase my attendance
          </button>
        </div>

        <div className="divider" />

        <h2>About</h2>
        <p className="note">
          An unofficial companion to the {META.department} timetable ({META.term}, effective{" "}
          {META.effectiveFrom}) for the {META.semester} {META.programme} class ({META.classTag}). It has no
          login server and no password — a roll number simply opens a record stored on this device. Anyone
          using this browser can read or change it. Confirm all attendance with the department.
        </p>
      </div>
    </div>
  );
}
