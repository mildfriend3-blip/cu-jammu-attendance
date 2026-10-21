# CU Jammu Sentinel

**Attendance intelligence and timetable console** for the B.Tech Cyber Security,
Semester I class (`I-CCS`) — Department of CSE & CSIT, Cluster University of Jammu.
Built on the department timetable for the **2026–27 odd semester** (effective
7 September 2026).

Local-first: there is no backend, no analytics and no tracking. Every record lives
in the browser's `localStorage`, so the whole product is a static site you can host
anywhere for free.

> **Not an official record.** Accounts are a local convenience, not server-verified
> authentication. Passwords are salted and hashed with PBKDF2-HMAC-SHA256
> (210,000 iterations), but the verifier is stored in the browser, so anyone with
> the device and devtools could read or replace it. Treat Sentinel as a personal
> tracker and confirm attendance with the department.

---

## Features

**Accounts**
- Roll-number sign-up and sign-in, one account per roll number **and** per name
  (both uniqueness checks are case-insensitive).
- PBKDF2-SHA256 password hashing with a per-account random salt, plus a live
  strength meter.
- Password policy is deliberately NIST SP 800-63B shaped: sign-up is blocked only
  by the length/character minimums and by matching a known common password.
  Everything else — no symbol, no uppercase, contains your name or roll number —
  is reported as advice and never rejected, because composition rules push people
  toward predictable passwords without adding much real entropy.
- "Keep me signed in" (30-day session) vs. tab-only session, plus a
  registered-accounts list for shared devices.
- Student and faculty account types.

**Timetable**
- Full weekly grid with live "current slot" highlighting and a today column.
- Search across code, subject and faculty; filter by subject or by theory/labs.
- Clickable class cards with venue notes (ECE Department, PMMMT Lab, Friday's
  "Class 6" room shift) and print support.

**Attendance**
- Mark Present / Absent / Cancelled per scheduled class on any date, with a
  weekday strip, bulk "all present" and "clear day".
- Cancelled classes are excluded from every percentage.
- Per-subject cards showing rate, counts, a 30-day trend and a plain-language
  verdict; overall ring gauge against a configurable target.
- Bunk maths both ways: how many you can still miss, or how many you must attend
  in a row to recover.

**Insights**
- 14-day daily-rate bar chart with a target line, subject comparison chart,
  14-week attendance heatmap, 7/30-day rolling rates, present streak and
  "if you attend the next 5 classes" projection.

**Faculty console**
- Passcode-gated class-wide view: cohort rate, per-subject cohort breakdown,
  full roster sorted by risk, bulk marking for a date across all accounts, and
  CSV export per student or for the whole roster.
- **Bulk CSV import** — load attendance taken on paper or in a spreadsheet. Every
  row is validated against the registered rolls and the timetable before anything
  is written (unknown roll, weekend date, no class in that slot, bad status and
  duplicates are each reported with their line number), so a bad row never
  half-imports. Accepts comma/semicolon/tab separators, `YYYY-MM-DD` or
  `DD/MM/YYYY` dates, and `P`/`A`/`C` or `present`/`absent`/`cancelled`. Includes a
  downloadable template and an import report.

**History & data**
- Day-grouped audit trail with filters and jump-to-edit.
- CSV exports (audit log, subject summary, roster) and JSON backup/import.

**Platform**
- Installable PWA with an offline service worker.
- Command palette (`⌘K` or `/`), keyboard shortcuts, dark and light themes.
- Local notifications for low attendance and upcoming classes.
- Responsive down to phone width; print stylesheet for the timetable and reports.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm test` | Unit tests for the CSV validator and the password scorer (65 assertions) |

Requires Node 18+ (Node 20 recommended).

> Web Crypto is required for password hashing, so run over `https://` or
> `localhost`. The deployed site is HTTPS, so this is only a dev concern.

---

## Deploying

### GitHub Pages
`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
Enable it once in **Settings → Pages → Build and deployment → Source:
GitHub Actions**.

### Vercel
`vercel.json` pins the framework (`vite`), build command and output directory, so
importing the repo is a one-click deploy. Or `vercel --prod` from the repo root.

### Netlify / any static host
Build command `npm run build`, publish directory `dist`.

Routing uses a hash router, so deep links and refreshes work on static hosts with
no rewrite rules.

---

## Tests

```bash
npm test
```

Bundles `src/lib/csv.ts` and `src/lib/crypto.ts` with esbuild and runs both suites
under Node — 65 assertions, no test framework needed.

- `scripts/test-csv.mjs` (29) — quoted fields, escaped quotes, BOM and blank-line
  handling, delimiter detection, both date formats, and every validation branch of
  the import (unknown roll, weekend, out-of-range slot, slot with no class, bad
  status, duplicate row, missing columns, overwrite counting).
- `scripts/test-password.mjs` (36) — the scorer's hard requirements, blocklist,
  identity penalties, label thresholds, and two regression guards: that reasonable
  passwords are never falsely rejected, and that any rejection always carries a
  non-empty reason (an empty one used to render as "Password needs ." with nothing
  after it).

---

## Docs

- [`docs/timetable-data.md`](docs/timetable-data.md) — how the schedule data is
  shaped and how to adapt it to another class.
- [`docs/backend-migration.md`](docs/backend-migration.md) — the trade-offs and
  concrete steps for moving from local storage to a hosted backend.

---

## Architecture

```
src/
  types.ts                     Shared domain types
  data/timetable.ts            Schedule, subjects, slots, notes, defaults
  lib/
    crypto.ts                  PBKDF2 hashing, password strength
    storage.ts                 Versioned localStorage: accounts, sessions, logs, settings
    attendance.ts              Session lookup, totals, percentages, bunk maths
    analytics.ts               Series, rolling rates, streaks, heatmap, projections
    csv.ts                     CSV parsing + import validation (unit-tested)
    export.ts                  CSV builders and file download
    date.ts                    ISO / weekday helpers
  state/
    AuthContext.tsx            Sign-up, sign-in, session restore, uniqueness rules
    AttendanceContext.tsx      Per-student log + settings, persisted on every write
    ToastContext.tsx           Transient notifications
  hooks/                       Clock, theme, hotkeys, notifications
  components/
    ui/                        Button, Field, Card, Modal, Badge, Stat, charts, icons
    layout/                    App shell (sidebar, topbar) and command palette
    auth/                      Sign-in / sign-up screen
    pages/                     Overview, Timetable, MarkDay, Subjects, Insights,
                               History, AdminConsole, Settings
  styles.css                   Design tokens and all component styling
scripts/test-csv.mjs           Node test runner for the CSV validator
docs/                          Data model and backend migration notes
```

### Data model

```ts
type Status = "P" | "A" | "C";        // present, absent, cancelled

interface Account {                    // secrets; never rendered directly
  roll: string; name: string; nameKey: string;
  salt: string; hash: string; iterations: number;
  role: "student" | "faculty";
  createdAt: number; lastSeenAt: number;
}

type Log = Record<string, Status>;     // key: "YYYY-MM-DD|slot", e.g. "2026-10-21|A"
```

Attendance is keyed by **date and slot**; the subject is resolved from the weekday
against `data/timetable.ts`. That keeps records valid if a subject is renamed, and
lets cancelled classes drop out of the denominator entirely.

```
percentage  = present ÷ (present + absent)
canMiss     = ⌊present ÷ target − held⌋
needed      = ⌈(target × held − present) ÷ (1 − target)⌉
```

### localStorage keys

| Key | Contents |
| --- | --- |
| `sentinel.accounts.v1` | Account array including salts and hashes |
| `sentinel.session.v1` | Current session (localStorage if remembered, else sessionStorage) |
| `sentinel.log.v1::<ROLL>` | Attendance log for one student |
| `sentinel.settings.v1::<ROLL>` | Target, alert prefs, exam date |
| `sentinel.faculty.v1` | Faculty console passcode |
| `sentinel.theme.v1` | Theme preference |

## Adapting it to another class

Everything schedule-related is in `src/data/timetable.ts` — `META`, `DAYS`,
`SLOTS`, `SUBJECTS`, the `TT` weekday→slot map, plus `LAB_SESSIONS` and
`SESSION_NOTES`. Change that one file and the grid, marking, analytics, CSV
exports and faculty console all follow.

## Adding real authentication

The storage layer is deliberately isolated behind `src/lib/storage.ts` and
`src/lib/crypto.ts`. To move to a server, replace those two modules with Supabase
(or equivalent) and keep the contexts' interfaces unchanged — the UI needs no
edits.

## License

MIT — see `LICENSE`. Timetable data belongs to the Department of CSE & CSIT,
Cluster University of Jammu.
