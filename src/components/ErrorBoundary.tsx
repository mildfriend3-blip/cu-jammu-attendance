import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence. A render crash anywhere in the tree would otherwise
 * leave a blank page, which is the worst possible outcome for someone halfway
 * through marking attendance — their data is still safe in localStorage, so the
 * fallback says so and offers a reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  private reload = () => window.location.reload();

  private copyDetails = async () => {
    const { error } = this.state;
    const text = [error?.name, error?.message, error?.stack].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      window.alert("Error details copied.");
    } catch {
      window.alert(text || "No details available.");
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card pad" style={{ maxWidth: 520, width: "100%" }}>
          <div className="badge bad" style={{ marginBottom: 14 }}>
            <span className="dot" /> Something broke
          </div>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
            Nothing has been lost — your attendance is stored in this browser and is unaffected. Reloading usually
            clears this.
          </p>
          <pre
            className="mono"
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "var(--bg-elev)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-sm)",
              fontSize: 11.5,
              maxHeight: 150,
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {error.name}: {error.message}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btn solid" onClick={this.reload}>
              Reload
            </button>
            <button className="btn" onClick={this.copyDetails}>
              Copy details
            </button>
          </div>
        </div>
      </div>
    );
  }
}
