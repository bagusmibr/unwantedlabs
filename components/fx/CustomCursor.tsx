"use client";
import { useEffect, useRef } from "react";
import { useFxLevel } from "./useFxLevel";
import styles from "./fx.module.css";

/**
 * Kursor sinematik: titik kecil + cincin yang menyusul dengan inersia.
 * - Membesar di atas tautan/tombol.
 * - Menampilkan label bila elemen punya data-cursor="Teks".
 * - mix-blend-mode difference → selalu kontras di atas hitam maupun putih.
 * Hanya untuk level "full" (mouse sungguhan). Kursor asli tetap ada di kolom
 * input supaya caret teks tidak hilang.
 */
export default function CustomCursor() {
  const level = useFxLevel();
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (level !== "full") return;
    const d = dot.current, r = ring.current, l = label.current;
    if (!d || !r || !l) return;

    document.documentElement.classList.add("has-fx-cursor");
    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my;
    let raf = 0;
    let shown = false;

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY;
      d.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (!shown) { shown = true; d.dataset.on = "1"; r.dataset.on = "1"; rx = mx; ry = my; }
    };
    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      r.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    const over = (e: Event) => {
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>("a, button, [data-cursor], summary, label, [role='switch'], [role='radio']");
      const text = t?.dataset.cursor ?? "";
      r.dataset.hover = t ? "1" : "";
      r.dataset.label = text ? "1" : "";
      l.textContent = text;
      const field = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']");
      d.dataset.hide = field ? "1" : "";
      r.dataset.hide = field ? "1" : "";
    };
    const down = () => { r.dataset.down = "1"; };
    const up = () => { r.dataset.down = ""; };
    const leave = () => { shown = false; d.dataset.on = ""; r.dataset.on = ""; };

    addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    document.documentElement.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.documentElement.classList.remove("has-fx-cursor");
    };
  }, [level]);

  if (level !== "full") return null;
  return (
    <>
      <div ref={ring} className={styles.cursorRing} aria-hidden="true">
        <span ref={label} className={styles.cursorLabel} />
      </div>
      <div ref={dot} className={styles.cursorDot} aria-hidden="true" />
    </>
  );
}
