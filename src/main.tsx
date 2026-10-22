import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AttendanceProvider } from "./state/AttendanceContext";
import { AuthProvider } from "./state/AuthContext";
import { ToastProvider } from "./state/ToastContext";
import { ensureSecurityMigration } from "./lib/storage";
import "./styles.css";

// Runs before first render so nothing can read a half-migrated gate.
ensureSecurityMigration().finally(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <HashRouter>
        <ErrorBoundary>
          <ToastProvider>
            <AuthProvider>
              <AttendanceProvider>
                <App />
              </AttendanceProvider>
            </AuthProvider>
          </ToastProvider>
        </ErrorBoundary>
        </HashRouter>
    </React.StrictMode>,
  );
});
