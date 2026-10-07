"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { useFxLevel } from "./useFxLevel";
import styles from "./fx.module.css";

/** Teks berjalan tanpa ujung. Berhenti saat di-hover. */
export function Marquee({ items, speed = 40, reverse = false }: { items: string[]; speed?: number; reverse?: boolean }) {
  const row = (
    <div className={styles.marqueeRow} aria-hidden="true">
      {items.map((t, i) => (
        <span key={i} className={styles.marqueeItem}>
          {t}
          <span className={styles.marqueeStar}>✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className={styles.marquee} aria-label={items.join(", ")}>
      <div
        className={styles.marqueeTrack}
        style={{ animationDuration: `${speed}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {row}
        {row}
      </div>
    </div>
  );
}

/** Angka yang berhitung naik saat pertama kali terlihat. */
export function CountUp({ to, duration = 1600, className, format }: { to: number; duration?: number; className?: string; format?: (n: number) => string }) {
  const level = useFxLevel();
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const shown = level === "off" ? to : val;

  useEffect(() => {
    if (level === "off") return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 4))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration, level]);

  return <span ref={ref} className={className}>{format ? format(shown) : shown}</span>;
}

/** Garis tipis di puncak layar yang menunjukkan seberapa jauh halaman digulir. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return <motion.div className={styles.progress} style={{ scaleX: x }} aria-hidden="true" />;
}

/** Butiran film di atas seluruh halaman — sangat tipis, kesan sinematik. */
export function FilmGrain() {
  const level = useFxLevel();
  return <div className={`${styles.grain} ${level === "full" ? styles.grainAnim : ""}`} aria-hidden="true" />;
}
