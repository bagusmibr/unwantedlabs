"use client";
import { useEffect } from "react";

export default function SecurityGuard() {
  useEffect(() => {
    // Disable right-click
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    // Block common DevTools shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12") { e.preventDefault(); return; }
      // Ctrl+Shift+I / Cmd+Option+I
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i")) {
        e.preventDefault(); return;
      }
      // Ctrl+Shift+J / Cmd+Option+J (console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "J" || e.key === "j")) {
        e.preventDefault(); return;
      }
      // Ctrl+Shift+C (element picker)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault(); return;
      }
      // Ctrl+U (view source)
      if ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U")) {
        e.preventDefault(); return;
      }
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
