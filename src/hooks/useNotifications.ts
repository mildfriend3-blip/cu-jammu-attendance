import { useCallback, useEffect, useRef, useState } from "react";

type Permission = "default" | "granted" | "denied" | "unsupported";

const SUPPORTED = typeof window !== "undefined" && "Notification" in window;

export function useNotifications() {
  const [permission, setPermission] = useState<Permission>(() =>
    SUPPORTED ? (Notification.permission as Permission) : "unsupported",
  );
  const [ready, setReady] = useState(false);
  const sent = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registered lazily so the shell still loads if the SW is unavailable.
    navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI).href, { scope: "./" })
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, []);

  const request = useCallback(async () => {
    if (!SUPPORTED) return "unsupported" as Permission;
    const result = (await Notification.requestPermission()) as Permission;
    setPermission(result);
    return result;
  }, []);

  /** Fires at most once per `key`, per page session. */
  const notify = useCallback(
    (key: string, title: string, body: string) => {
      if (!SUPPORTED || Notification.permission !== "granted") return false;
      if (sent.current.has(key)) return false;
      sent.current.add(key);
      try {
        new Notification(title, { body, icon: new URL("favicon.svg", document.baseURI).href, tag: key });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  return { permission, request, notify, serviceWorkerReady: ready, supported: SUPPORTED };
}
