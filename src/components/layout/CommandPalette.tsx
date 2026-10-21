import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SUBJECTS } from "../../data/timetable";
import { Icon } from "../ui/icons";

export interface Command {
  id: string;
  label: string;
  group: string;
  icon: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string, label: string, icon: string, group: string): Command => ({
      id: path,
      label,
      group,
      icon,
      run: () => {
        navigate(path);
        onClose();
      },
    });
    const nav: Command[] = [
      go("/", "Open overview", "dashboard", "Navigate"),
      go("/timetable", "Open timetable", "calendar", "Navigate"),
      go("/attendance", "Mark attendance", "checkCircle", "Navigate"),
      go("/subjects", "Open subjects", "book", "Navigate"),
      go("/insights", "Open insights", "trend", "Navigate"),
      go("/history", "Open history", "clock", "Navigate"),
      go("/admin", "Open faculty console", "users", "Navigate"),
      go("/settings", "Open settings", "settings", "Navigate"),
    ];
    const subjects: Command[] = Object.values(SUBJECTS).map((s) => ({
      id: `subject-${s.code}`,
      label: `${s.code} — ${s.name}`,
      group: "Subjects",
      icon: "book",
      run: () => {
        navigate(`/subjects?focus=${s.code}`);
        onClose();
      },
    }));
    return [...nav, ...subjects];
  }, [navigate, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.group}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[cursor]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  let lastGroup = "";

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="pi">
          <Icon name="search" size={17} style={{ color: "var(--ink-3)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, subjects, actions…"
            aria-label="Search commands"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="plist">
          {results.length === 0 && <div className="empty" style={{ padding: "26px 12px" }}>No matches</div>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {header && (
                  <div className="gp" style={{ padding: "8px 11px 4px" }}>
                    {header}
                  </div>
                )}
                <button
                  className={`pitem ${i === cursor ? "sel" : ""}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={c.run}
                >
                  <Icon name={c.icon} size={16} />
                  <span className="tt">{c.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
