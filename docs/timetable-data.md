# Timetable data

Everything schedule-related lives in `src/data/timetable.ts`:

| Export | Purpose |
| --- | --- |
| `META` | Department, programme, semester, room, term, effective date |
| `DAYS` | Teaching days (Monday–Friday) |
| `SLOTS` | The nine daily periods with their department labels and times |
| `SUBJECTS` | Course code → name, short name, faculty, colour token |
| `TT` | Weekday → slot → course code. A missing slot means no class |
| `LAB_SESSIONS` | `"Day\|slot"` keys that are practicals rather than lectures |
| `SESSION_NOTES` | Venue changes and lab locations shown on the class card |
| `DEFAULT_SETTINGS` | Target percentage, alert preferences |
| `DEFAULT_FACULTY_PASSCODE` | Initial passcode for the faculty console |

Source: Department of CSE & CSIT, Cluster University of Jammu — 2026-27 odd
semester timetable, effective 7 September 2026, Semester I Cyber Security (I-CCS).

To support another class, copy this file and change `META`, `SUBJECTS` and `TT`.
The grid, marking, analytics, CSV exports and faculty console all derive from it,
so no other file needs editing.

Note the data is a **weekly recurrence**, not a calendar. Attendance is stored
against real dates (`YYYY-MM-DD|slot`) and the subject is resolved by looking up
the weekday, which keeps records valid if a subject is later renamed.
