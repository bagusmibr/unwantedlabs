"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useFxLevel } from "@/components/fx/useFxLevel";
import styles from "./patch-fx.module.css";

export type StepState = "pending" | "active" | "done" | "error";
export interface PatchStep { key: string; label: string; detail?: string; state: StepState }

/**
 * Daftar langkah patch yang hidup: menunggu → berjalan (garis pindai) → ✓.
 * Bilah progres di atas mengikuti jumlah langkah yang selesai.
 */
export function PatchSteps({ steps }: { steps: PatchStep[] }) {
  const done = steps.filter((s) => s.state === "done").length;
  const active = steps.some((s) => s.state === "active");
  const pct = Math.round(((done + (active ? 0.5 : 0)) / steps.length) * 100);
  return (
    <div className={styles.steps}>
      <div className={styles.bar} aria-hidden="true">
        <motion.span className={styles.barFill} animate={{ scaleX: pct / 100 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <div className={styles.pct} aria-live="polite">{pct}%</div>
      <ol className={styles.list}>
        {steps.map((s, i) => (
          <motion.li
            key={s.key}
            className={`${styles.item} ${styles[`st_${s.state}`]}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
          >
            <span className={styles.icon} aria-hidden="true">
              {s.state === "done" ? (
                <svg viewBox="0 0 16 16" width="12" height="12">
                  <motion.path
                    d="M3 8.5l3.2 3.2L13 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35 }}
                  />
                </svg>
              ) : s.state === "error" ? "×" : s.state === "active" ? <span className={styles.spin} /> : String(i + 1).padStart(2, "0")}
            </span>
            <span className={styles.label}>{s.label}</span>
            <AnimatePresence>
              {s.detail && s.state === "done" && (
                <motion.span className={styles.detail} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{s.detail}</motion.span>
              )}
            </AnimatePresence>
            {s.state === "active" && <span className={styles.scan} aria-hidden="true" />}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Ledakan partikel putih dari tengah elemen induk saat file siap — canvas 2D,
 * sekali jalan (~1,6 dtk), lalu membersihkan diri. Mati di level "off".
 */
export function SuccessBurst({ fire }: { fire: number }) {
  const level = useFxLevel();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire || level === "off") return;
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.scale(dpr, dpr);

    const count = level === "full" ? 140 : 70;
    const ps = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 7;
      return {
        x: w / 2, y: h / 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
        r: 0.8 + Math.random() * 2.2,
        life: 1,
        decay: 0.012 + Math.random() * 0.018,
        sq: Math.random() < 0.35, // sebagian kotak kecil, kesan "piksel"
      };
    });
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of ps) {
        if (p.life <= 0) continue;
        alive++;
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.97; p.vy = p.vy * 0.97 + 0.08;
        p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = "#fff";
        if (p.sq) ctx.fillRect(p.x, p.y, p.r * 1.6, p.r * 1.6);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      }
      if (alive) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire, level]);

  return <canvas ref={ref} className={styles.burst} aria-hidden="true" />;
}
