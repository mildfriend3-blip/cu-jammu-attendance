import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useToast, type ToastKind } from "../../state/ToastContext";
import { Icon } from "./icons";

/* ------------------------------------------------------------------ Button */
type Variant = "default" | "solid" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: string;
  iconRight?: string;
}

export function Button({
  variant = "default",
  size = "md",
  block,
  icon,
  iconRight,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const cls = ["btn", variant !== "default" ? variant : "", size !== "md" ? size : "", block ? "block" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 14 : 16} />}
    </button>
  );
}

/* ------------------------------------------------------------------- Field */
interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  aside?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, hint, error, aside, children, htmlFor }: FieldProps) {
  return (
    <div className="field">
      <label className="lbl" htmlFor={htmlFor}>
        <span>{label}</span>
        {aside}
      </label>
      {children}
      {error ? (
        <div className="err" role="alert">
          <Icon name="alert" size={13} style={{ marginTop: 2, flex: "none" }} />
          <span>{error}</span>
        </div>
      ) : (
        hint && <div className="hint">{hint}</div>
      )}
    </div>
  );
}

export function Input({ className = "", invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={`input ${invalid ? "invalid" : ""} ${className}`.trim()} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`select ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}

/* -------------------------------------------------------------------- Card */
export function Card({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section className={`card ${className}`.trim()} style={style}>
      {children}
    </section>
  );
}

export function CardHead({
  title,
  sub,
  actions,
  style,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <header className="card-head" style={style}>
      <div>
        <h2>{title}</h2>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </header>
  );
}

export function CardBody({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={`card-body ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */
export function Badge({
  tone = "neutral",
  dot,
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "bad" | "info";
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`badge ${tone === "neutral" ? "" : tone}`.trim()}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------- Stat */
export function Stat({
  label,
  value,
  unit,
  detail,
  icon,
  accent,
  children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  icon?: string;
  accent?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`.trim()}>
      <div className="k">
        {icon && <Icon name={icon} size={13} />}
        {label}
      </div>
      <div className="v tnum">
        {value}
        {unit && <small> {unit}</small>}
      </div>
      {detail && <div className="d">{detail}</div>}
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Progress */
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? "var(--accent)" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Avatar */
export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" | "xl" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return <div className={`avatar ${size === "md" ? "" : size}`.trim()}>{initials || "?"}</div>;
}

/* ------------------------------------------------------------------- Modal */
export function Modal({
  title,
  accent,
  onClose,
  children,
  footer,
  labelledBy = "modal-title",
}: {
  title: ReactNode;
  accent?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        ref={ref}
        style={{ ["--mc" as string]: accent ?? "var(--accent)" }}
      >
        <div className="mh">
          <h3 id={labelledBy} style={{ fontSize: 17 }}>{title}</h3>
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- EmptyState */
export function EmptyState({ icon = "info", title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} style={{ color: "var(--ink-3)", marginBottom: 10 }} />
      <div className="t">{title}</div>
      {body && <div style={{ fontSize: 13, maxWidth: "44ch", margin: "0 auto" }}>{body}</div>}
      {action && <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>{action}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- Segmented */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- Toasts */
const TOAST_ICON: Record<ToastKind, string> = {
  info: "info",
  success: "checkCircle",
  warn: "alert",
  error: "alert",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind === "success" ? "" : t.kind}`.trim()}>
          <Icon name={TOAST_ICON[t.kind]} size={16} style={{ color: `var(--${t.kind === "success" ? "accent" : t.kind === "warn" ? "warn" : t.kind === "error" ? "danger" : "info"})`, flex: "none" }} />
          <span>{t.message}</span>
          <button className="x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
