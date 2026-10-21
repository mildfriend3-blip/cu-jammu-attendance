import { useEffect } from "react";

type Handler = (event: KeyboardEvent) => void;

/**
 * Binds a keydown handler. Pass `"mod+k"` style combos or plain keys.
 * Ignores keystrokes while the user is typing in a field unless the combo
 * includes a modifier.
 */
export function useHotkeys(map: Record<string, Handler>): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      for (const [combo, handler] of Object.entries(map)) {
        const parts = combo.toLowerCase().split("+");
        const key = parts[parts.length - 1];
        const needsMod = parts.includes("mod");
        const needsShift = parts.includes("shift");
        const hasMod = event.metaKey || event.ctrlKey;

        if (event.key.toLowerCase() !== key) continue;
        if (needsMod !== hasMod) continue;
        if (needsShift && !event.shiftKey) continue;
        if (typing && !hasMod) continue;

        event.preventDefault();
        handler(event);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [map]);
}
