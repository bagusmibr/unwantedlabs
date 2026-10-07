"use client";
import { useRef } from "react";
import { useFxLevel } from "./useFxLevel";
import styles from "./fx.module.css";

/**
 * Kartu yang miring mengikuti kursor, dengan kilau cahaya yang ikut bergerak.
 * Hanya aktif di level "full"; selain itu jadi div biasa.
 */
export default function Tilt({
  children,
  className = "",
  max = 8,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  style?: React.CSSProperties;
}) {
  const level = useFxLevel();
  const ref = useRef<HTMLDivElement>(null);
  const on = level === "full";

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!on || !el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - py) * max}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * max}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
    el.dataset.tilt = "1";
  }
  function leave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.dataset.tilt = "";
  }

  return (
    <div
      ref={ref}
      className={`${on ? styles.tilt : ""} ${className}`}
      style={style}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      {children}
      {on && <span className={styles.tiltGlare} aria-hidden="true" />}
    </div>
  );
}
