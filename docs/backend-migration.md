# Moving from local storage to a real backend

This app keeps every account and attendance record in the browser's
`localStorage`. That was a deliberate choice — it means no server, no hosting
cost and no student data leaving the device — but it has two consequences worth
understanding before you decide whether to change it.

## What you get today

| | Local (current) |
| --- | --- |
| Accounts | Roll number + PBKDF2-SHA256 hashed password, stored per browser |
| Enforcement | A determined user with devtools can read or replace the verifier |
| Attendance | Lives only in the browser that recorded it |
| Cross-device | No — a student's record does not follow them to another phone |
| Faculty view | Only sees students registered in *that* browser |
| Privacy | Nothing leaves the device |

## What a backend adds

A hosted Postgres + auth provider (Supabase is the smallest step up) gives you:

- genuine server-verified sign-in, so the client cannot forge a session;
- attendance that follows the student across devices;
- one roster the faculty console can see in full, instead of only local accounts;
- row-level security, so a student can only read and write their own rows;
- an audit trail with `created_at` / `updated_at` that the client cannot rewrite.

The trade-off is that attendance data now leaves the device and lives in a
database you are responsible for. If the privacy property matters to you — it is
currently stated on the sign-in screen — keep the local model.

## The seam

Everything that touches persistence is behind two modules:

- `src/lib/storage.ts` — accounts, sessions, attendance logs, settings
- `src/lib/crypto.ts` — password hashing and strength scoring

The React layer only talks to `AuthContext` and `AttendanceContext`, whose
interfaces do not mention localStorage. So a migration means reimplementing those
two modules and the two contexts' internals — **no component changes**.

## Suggested schema

```sql
-- profiles: one row per student, keyed by roll number
create table public.profiles (
  roll        text primary key,
  name        text not null,
  name_key    text not null unique,          -- lowercased, enforces unique names
  role        text not null default 'student'
                check (role in ('student','faculty')),
  created_at  timestamptz not null default now()
);

-- attendance: one row per student, per class occurrence
create table public.attendance (
  id          bigint generated always as identity primary key,
  roll        text not null references public.profiles(roll) on delete cascade,
  class_date  date not null,
  slot        char(1) not null check (slot in ('A','B','C','D','E','F','G','H','I')),
  status      char(1) not null check (status in ('P','A','C')),
  updated_at  timestamptz not null default now(),
  unique (roll, class_date, slot)
);

create index attendance_roll_date_idx on public.attendance (roll, class_date desc);
```

### Day locks

The "submit & lock" rule is currently enforced in the client, which stops a
student editing their own record through the UI but not a determined user with
devtools. To make it a real guarantee, the lock has to be enforced where the
student cannot reach it:

```sql
alter table public.attendance add column locked_at timestamptz;

-- students may only touch their own rows, and only while unlocked
create policy "students write unlocked rows only" on public.attendance
  for update using (
    roll = (select raw_user_meta_data->>'roll' from auth.users where id = auth.uid())
    and locked_at is null
  );

-- only faculty may clear a lock
create policy "faculty unlock" on public.attendance
  for update using (
    (select raw_user_meta_data->>'role' from auth.users where id = auth.uid()) = 'faculty'
  );
```

Row-level security is what makes it safe to ship the anon key in a static bundle:

```sql
alter table public.profiles   enable row level security;
alter table public.attendance enable row level security;

-- a student reads and writes only their own rows; faculty read everything
create policy "own profile" on public.profiles
  for select using (auth.uid() = (select id from auth.users where email = roll || '@cuj.local'));

create policy "own attendance" on public.attendance
  for all using (
    roll = (select raw_user_meta_data->>'roll' from auth.users where id = auth.uid())
  );
```

Authentication itself should go through the provider's own flow (email or
phone based), with the roll number carried in `user_metadata` — do **not** try to
reimplement password hashing on the client, which is what the local mode has to do.

### Password recovery

Recovery is the clearest example of what a backend buys you. Locally, a reset can
only work on the one browser that holds the account, and the "email request" path
is just a `mailto:` the student sends themselves. With a provider you get the real
thing: the student enters their address, the provider mails a signed, expiring
reset link, and the password changes server-side without anyone trusting the
client. That flow replaces the recovery-code path entirely — delete
`src/lib/recovery.ts`'s code handling and call the provider's
`resetPasswordForEmail` instead.

## Suggested steps

1. Create the Supabase project and run the SQL above.
2. `npm i @supabase/supabase-js`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local` (never commit them).
4. Add `src/lib/supabase.ts` exporting a configured client.
5. Rewrite `src/lib/storage.ts` against the client, keeping the exported function
   names identical.
6. Replace the body of `AuthContext.signUp` / `signIn` with provider calls; keep
   the `AuthResult` return shape so the forms do not change.
7. Keep the CSV importer as-is — it validates against a roster, so it only needs
   the roster source swapped from `listAccounts()` to a query.
