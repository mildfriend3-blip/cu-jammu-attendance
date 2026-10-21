import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AttendanceProvider } from "./state/AttendanceContext";
import { AuthProvider } from "./state/AuthContext";
import { ToastProvider } from "./state/ToastContext";
import "./styles.css";

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
