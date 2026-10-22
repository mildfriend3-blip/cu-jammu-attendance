# Security model

This document states what the app defends against, what it does not, and why.
It exists so the limits are written down rather than assumed.

## The short version

CUJ Attendance is a **static client-side application with no server**. It stores
everything in the browser's `localStorage`. That single fact determines the whole
security model: anything running in the browser can read and modify anything the
app stores.

**It cannot be made unexploitable.** Anyone who controls the browser — the device
owner, someone with devtools, a malicious extension, or injected script — can read
the data and bypass every client-side check. No amount of client-side hardening
changes that. Only a backend can.

What the app *can* do is remove disclosures and weak defaults, avoid leaking data
to third parties, and make casual misuse inconvenient. That is what is implemented.

## Threat model

| Adversary | In scope? | What stops them |
| --- | --- | --- |
| A classmate reading the screen | Yes | The faculty passcode is never displayed; no default exists; attempts are throttled |
| A classmate guessing the faculty passcode | Yes | No shipped default, PBKDF2-verified, throttled with escalating lockouts |
| A classmate editing their own attendance after submitting | Yes | Day locks; the write guard sits in the state layer, not the UI |
| A classmate editing their own record with devtools | **No** | Nothing. They own the browser. |
| Someone reading another student's record with devtools | **No** | Nothing. All accounts share one origin's storage. |
| A third party observing traffic | Yes | No third-party requests at all; fonts self-hosted; strict CSP; `no-referrer` |
| Tampering with the deployed site | Partly | HTTPS, strict CSP, no source maps shipped, immutable hashed assets |

## Controls implemented

**Secrets are never stored in clear text.**
Account passwords and recovery codes are PBKDF2-HMAC-SHA256 (210,000 iterations,
per-record random salt). The faculty passcode is stored the same way. Earlier
versions stored the passcode in plain text; a migration hashes any existing value
and discards the old shipped default outright.

**No shipped default credential.** There is no default faculty passcode. The
console stays shut until someone generates one, and the generated value is shown
once and never again. The app never displays, hints at, or prints the passcode.

**Changing the gate requires the current gate.** A signed-in student cannot
silently replace the faculty passcode, because the change form verifies the
current one first.

**Throttling.** Five wrong passcode attempts are free; after that, lockouts of
30s → 60s → 120s → 300s → 900s (capped), reset on success. This is stored locally,
so a determined attacker can clear it — it raises the cost of the realistic
threat (repeated guessing on a shared machine), nothing more.

**Login does not reveal which roll numbers exist.** A wrong roll number and a
wrong password produce the same message, so the form cannot be used to enumerate
the roster. The same applies to the recovery-code form.

**No third-party requests.** Fonts are self-hosted. There is no analytics, no
telemetry, no CDN. A student's session contacts nothing but the host serving the
app. This is also why the "nothing leaves the device" claim holds.

**Content Security Policy.** `default-src 'self'; script-src 'self'; object-src
'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. There is no
inline script. Sent as a response header on Vercel and Netlify, and injected into
the HTML at build time for GitHub Pages, which cannot set headers.

**Other headers.** `X-Content-Type-Options: nosniff`, `Referrer-Policy:
no-referrer`, `X-Frame-Options: DENY`, a restrictive `Permissions-Policy`, and HSTS
where the host supports it.

**No source maps in the shipped bundle**, so the deployed JS is not accompanied by
a readable copy of the source.

**Backups and exports are explicit.** CSV and JSON files are produced only when
the user asks, via a blob download; nothing is uploaded anywhere.

## Known limitations

1. **Client-side checks are advisory.** Day locks, the write guard and the faculty
   gate all run in the browser. They stop mistakes and casual tampering; they do
   not stop anyone who opens devtools.
2. **All accounts share one storage origin.** On a shared device, unlocking the
   console exposes every account registered in that browser, including roll
   numbers and names.
3. **The faculty gate protects a shared device, not a remote one.** It cannot
   stop a student on their own phone, because their data is on their own phone.
4. **Recovery works per browser.** A reset affects the copy of the account in the
   browser where it runs.
5. **No password is recoverable.** If a passcode or recovery code is lost there is
   no backdoor — that is deliberate. Clearing site data resets the app.
6. **GitHub Pages cannot send security headers.** On that host the CSP is enforced
   via the injected meta tag; the other headers are absent. Vercel and Netlify get
   the full set.

## If you need real security

Move authentication and data to a server. `docs/backend-migration.md` has the
schema, the row-level-security policies, and the exact seam to change. With a
provider you get: server-verified sessions the client cannot forge, per-student
row-level security, cross-device data, an audit trail the client cannot rewrite,
and genuine email-based password reset.

## Reporting

This is a student project and not an official record. If you find a problem,
open an issue on the repository.
