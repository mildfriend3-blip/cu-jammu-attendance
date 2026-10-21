# CU Jammu · Cyber Security — Timetable & Attendance

An unofficial, offline-first web app for the **B.Tech Cyber Security, Semester I**
class (`I-CCS`) of the Department of CSE & CSIT, Cluster University of Jammu —
built from the department timetable for the **2026–27 odd semester** (effective
7 September 2026).

It does two things:

1. **Interactive timetable** — the week's classes in a clickable grid with a live
   "current class" indicator, filters and a search box.
2. **Per-student attendance tracker** — sign in with a roll number and mark each
   class Present / Absent / Cancelled, then see your percentage per subject, an
   overall figure, and how many classes you can afford to miss.

Built with **React + TypeScript + Vite**. There is no backend: all data lives in
the browser's `localStorage`, so the whole thing is a static site you can host
anywhere for free.

> **Not an official record.** The sign-in is a local profile, not real
> authentication — there is no password and no server. Anyone using the same
> browser can read or change any record. Treat the numbers as a personal
> convenience and always confirm attendance with the department.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check, then build to dist/
npm run preview    # serve the production build locally
npm run typecheck  # tsc --noEmit only
```

Requires Node 18+ (Node 20 recommended).

---

## Deploying

### GitHub Pages (included)

A workflow at `.github/workflows/deploy.yml` builds and publishes the site.

1. Push this repo to GitHub (branch `main`).
2. In **Settings → Pages → Build and deployment**, set **Source** to
   **GitHub Actions**.
3. Push again (or run the workflow manually). The site appears at
   `https://<user>.github.io/<repo>/`.

Routing uses a hash router, so deep links and refreshes work on Pages without
any server rewrites.

### Vercel

Import the repo at [vercel.com/new](https://vercel.com/new). Vercel detects Vite
automatically — build command `npm run build`, output directory `dist`.

### Netlify

New site from Git → build command `npm run build`, publish directory `dist`.

### Any static host

Run `npm run build` and upload the contents of `dist/`.

---

## Project structure

```
src/
  data/timetable.ts        Semester I schedule, subjects and slot metadata
  types.ts                 Shared TypeScript types
  lib/
    date.ts                ISO / weekday helpers
    storage.ts             localStorage read & write per roll number
    attendance.ts          Session lookup, totals, percentages, bunk maths
  state/StudentContext.tsx Auth-by-roll-number state + attendance mutations + toasts
  components/
    Login.tsx              Roll-number sign-in and "continue as" list
    Layout.tsx             Top bar, tab navigation, toast host
    TimetableView.tsx      The interactive weekly grid
    TodayView.tsx          Mark a date's classes P / A / C
    SubjectsView.tsx       Per-subject percentages and verdicts
    HistoryView.tsx        Every marked day
    SettingsView.tsx       Target %, backup export/import, switch/erase
  App.tsx                  Route table
  main.tsx                 Entry point
  styles.css               Design tokens and all styling
```

## Data model

```ts
type Status = "P" | "A" | "C";           // present, absent, cancelled

interface StudentRecord {
  roll: string;
  name: string;
  target: number;                        // required attendance %, default 75
  createdAt: number;
  updatedAt: number;
  log: Record<string, Status>;           // key: "YYYY-MM-DD|slot", e.g. "2026-10-21|A"
}
```

Attendance is keyed by date **and** slot, and the subject is resolved from the
weekday against `data/timetable.ts`. That means a record stays valid even if a
subject's name changes, and cancelled classes are excluded from the percentage
entirely.

Percentage is `present / (present + absent)`; the bunk calculator uses
`target` to report either how many classes can still be missed or how many must
be attended in a row to recover.

## Editing the timetable

Everything schedule-related is in `src/data/timetable.ts` — `DAYS`, `SLOTS`,
`SUBJECTS` and the `TT` map of weekday → slot → course code. Update those and the
whole app (grid, marking, percentages) follows.

## License

MIT — see `LICENSE`. Timetable data belongs to the Department of CSE & CSIT,
Cluster University of Jammu.
