"use client";
import { useRef } from "react";
import { useFxLevel } from "./useFxLevel";

/**
 * Pembungkus "magnet": isinya tertarik sedikit ke arah kursor, lalu kembali
 * dengan pegas saat kursor pergi. Cocok untuk tombol CTA.
 */
export default function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const level = useFxLevel();
  const ref = useRef<HTMLSpanElement>(null);

  function move(e: React.PointerEvent<HTMLSpanElement>) {
    const el = ref.current;
    if (level !== "full" || !el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * strength;
    const y = (e.clientY - (r.top + r.height / 2)) * strength;
    el.style.transition = "transform 0.15s ease-out";
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
  function leave() {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 0.7s cubic-bezier(0.22, 1.4, 0.36, 1)";
    el.style.transform = "translate3d(0, 0, 0)";
  }

  return (
    <span ref={ref} className={className} style={{ display: "inline-flex" }} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </span>
  );
}
