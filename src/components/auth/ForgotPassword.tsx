import { useMemo, useState, type FormEvent } from "react";
import { META } from "../../data/timetable";
import { buildResetMailto } from "../../lib/recovery";
import { loadFacultyEmail } from "../../lib/storage";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { Button, Field, Input, Modal, Segmented } from "../ui";
import { Icon } from "../ui/icons";

type Path = "code" | "email";

export default function ForgotPassword({
  initialRoll,
  onClose,
  onReset,
}: {
  initialRoll: string;
  onClose: () => void;
  onReset: (roll: string) => void;
}) {
  const { resetWithRecoveryCode, hasRecovery } = useAuth();
  const { push } = useToast();

  const [path, setPath] = useState<Path>("code");
  const [roll, setRoll] = useState(initialRoll);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  const facultyEmail = useMemo(() => loadFacultyEmail(), []);
  const rollKnown = roll.trim().length > 2;
  const recoveryAvailable = rollKnown && hasRecovery(roll);

  const mailto = useMemo(
    () =>
      buildResetMailto({
        to: facultyEmail,
        app: META.product,
        department: `${META.department}, ${META.university}`,
        roll: roll.trim().toUpperCase(),
        name: name,
      }),
    [facultyEmail, roll, name],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await resetWithRecoveryCode(roll, code, next);
      if (!result.ok) {
        setError({ field: result.field, message: result.message ?? "Could not reset the password." });
        return;
      }
      push("Password reset — you can sign in now", "success");
      onReset(roll.trim().toUpperCase());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Reset your password"
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Segmented<Path>
        value={path}
        label="Reset method"
        onChange={setPath}
        options={[
          { value: "code", label: "Recovery code" },
          { value: "email", label: "Email request" },
        ]}
      />

      {path === "code" && (
        <form onSubmit={submit} style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>
            If you saved a recovery code when you signed up, enter it here with a new password.
          </p>

          <Field label="Roll number" htmlFor="fp-roll">
            <Input
              id="fp-roll"
              className="mono"
              value={roll}
              autoComplete="username"
              spellCheck={false}
              onChange={(e) => setRoll(e.target.value.toUpperCase())}
            />
          </Field>

          {rollKnown && !recoveryAvailable && (
            <div className="hint" style={{ color: "var(--warn)" }}>
              <Icon name="alert" size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              No recovery code is set for this roll number. Use the email request instead, or ask faculty to reset it.
            </div>
          )}

          <Field label="Recovery code" htmlFor="fp-code">
            <Input
              id="fp-code"
              className="mono"
              value={code}
              placeholder="e.g. K7RM-3QPZ-9TFH"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>

          <Field label="New password" htmlFor="fp-next" error={error?.field === "next" ? error.message : undefined}>
            <Input
              id="fp-next"
              type="password"
              value={next}
              autoComplete="new-password"
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>

          <Field label="Confirm new password" htmlFor="fp-confirm">
            <Input
              id="fp-confirm"
              type="password"
              value={confirm}
              autoComplete="new-password"
              invalid={Boolean(confirm) && confirm !== next}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          {error && error.field !== "next" && (
            <div className="err" role="alert">
              <Icon name="alert" size={13} style={{ marginTop: 2, flex: "none" }} />
              <span>{error.message}</span>
            </div>
          )}

          <Button type="submit" variant="solid" block disabled={busy}>
            {busy ? "Please wait…" : "Set new password"}
          </Button>
        </form>
      )}

      {path === "email" && (
        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>
            This app has no server, so it cannot send mail or reset an account by itself. Opening the request below
            fills in your mail app — you send it, and whoever administers the app resets your password.
          </p>

          <Field label="Roll number" htmlFor="fp-roll2" hint="Included in the request so faculty can identify you.">
            <Input
              id="fp-roll2"
              className="mono"
              value={roll}
              spellCheck={false}
              onChange={(e) => setRoll(e.target.value.toUpperCase())}
            />
          </Field>

          <Field label="Your name" htmlFor="fp-name" hint="Also included, so the request is not anonymous.">
            <Input
              id="fp-name"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <div
            style={{
              border: "1px solid var(--line)",
              borderLeft: "3px solid var(--info)",
              borderRadius: "var(--r-sm)",
              background: "var(--surface-2)",
              padding: "11px 13px",
              fontSize: 12.5,
              color: "var(--ink-2)",
            }}
          >
            {facultyEmail ? (
              <>
                Sending to <span className="mono">{facultyEmail}</span>
              </>
            ) : (
              <>
                No recipient is set, so the mail will open without an address. Someone can set one in Settings.
              </>
            )}
          </div>

          <Button
            variant="solid"
            block
            icon="upload"
            onClick={() => {
              window.location.href = mailto;
              push("Opening your mail app…");
            }}
          >
            Open email request
          </Button>

          <p className="hint" style={{ margin: 0 }}>
            If nothing opens, copy the address above and write to them from any mail app. Faculty can also reset a
            password directly from the console on a shared device.
          </p>
        </div>
      )}

      <p className="hint" style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        Recovery codes are stored as a salted PBKDF2 hash, like your password. Because they live in this browser, a
        reset works only on the device where you registered.
      </p>
    </Modal>
  );
}
