import { useId } from "react";
import type { HeatCell } from "../../types";

/* --------------------------------------------------------------- Ring gauge */
export function Ring({
  value,
  size = 92,
  stroke = 8,
  color = "var(--accent)",
  caption = "attendance",
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  caption?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.7,.3,1)" }}
        />
      </svg>
      <div className="val">
        <b className="tnum">{value === null ? "—" : `${value.toFixed(1)}%`}</b>
        <span>{caption}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Bar chart */
/**
 * Bars are drawn in an SVG stretched to the container width (preserveAspectRatio
 * "none"), so axis text must NOT live inside that SVG — it would be scaled
 * horizontally and distorted. Labels are rendered as an HTML row instead.
 */
export function Bars({
  data,
  height = 132,
  unit = "",
  target,
  max,
}: {
  data: { label: string; value: number | null; bad?: boolean }[];
  height?: number;
  unit?: string;
  target?: number;
  max?: number;
}) {
  const top = Math.max(max ?? 100, target ?? 0, ...data.map((d) => d.value ?? 0));
  const labelStep = Math.max(1, Math.ceil(data.length / 7));
  const bw = 100 / Math.max(1, data.length);
  const plot = height; // full SVG box; bars sit on the baseline

  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 100 ${plot}`}
        preserveAspectRatio="none"
        role="img"
        style={{ height: plot, display: "block" }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} className="gridline" x1={0} x2={100} y1={plot - g * (plot - 6) - 1} y2={plot - g * (plot - 6) - 1} />
        ))}
        {typeof target === "number" && (
          <line
            x1={0}
            x2={100}
            y1={plot - (target / top) * (plot - 6) - 1}
            y2={plot - (target / top) * (plot - 6) - 1}
            stroke="var(--warn)"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {data.map((d, i) => {
          const v = d.value ?? 0;
          const h = (v / top) * (plot - 6);
          return (
            <rect
              key={`${d.label}-${i}`}
              className={`cbar ${d.bad ? "bad" : ""}`.trim()}
              x={i * bw + bw * 0.18}
              y={plot - h - 1}
              width={bw * 0.64}
              height={Math.max(1.5, h)}
              rx={0.8}
            />
          );
        })}
        <title>{`Bar chart, values in ${unit || "percent"}`}</title>
      </svg>
      <div style={{ display: "flex", marginTop: 6 }}>
        {data.map((d, i) => (
          <span
            key={`l-${d.label}-${i}`}
            className="mono"
            title={d.label}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              fontSize: 9.5,
              color: "var(--ink-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {/* show roughly seven labels at most, so they never overlap */}
            {i % labelStep === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Sparkline */
export function Sparkline({
  points,
  width = 120,
  height = 40,
  color = "var(--accent)",
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const id = useId().replace(/[:]/g, "");
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => [i * step, height - ((p - min) / span) * (height - 6) - 3] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg className="chart spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r={2.6} fill="var(--bg)" stroke={color} strokeWidth={1.8} />
    </svg>
  );
}

/* ----------------------------------------------------------------- Heatmap */
export function Heatmap({ cells }: { cells: HeatCell[] }) {
  return (
    <div>
      <div className="heat" role="img" aria-label="Attendance heatmap">
        {cells.map((c) => (
          <i key={c.date} data-l={c.level === null ? "x" : String(c.level)} title={c.title} />
        ))}
      </div>
      <div className="heat-legend" style={{ marginTop: 10, justifyContent: "flex-end" }}>
        <span>less</span>
        <i className="heat-swatch" style={{ width: 12, height: 12, borderRadius: 3, background: "var(--surface-3)", display: "inline-block" }} />
        <i style={{ width: 12, height: 12, borderRadius: 3, background: "color-mix(in srgb, var(--danger) 75%, transparent)", display: "inline-block" }} />
        <i style={{ width: 12, height: 12, borderRadius: 3, background: "color-mix(in srgb, var(--warn) 75%, transparent)", display: "inline-block" }} />
        <i style={{ width: 12, height: 12, borderRadius: 3, background: "color-mix(in srgb, var(--accent) 55%, transparent)", display: "inline-block" }} />
        <i style={{ width: 12, height: 12, borderRadius: 3, background: "var(--accent)", display: "inline-block" }} />
        <span>more</span>
      </div>
    </div>
  );
}
