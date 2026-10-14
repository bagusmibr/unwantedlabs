"use client";
import { useEffect, useRef } from "react";
import { useFxLevel } from "@/components/fx/useFxLevel";
import styles from "./SceneCut.module.css";

/**
 * Transisi antar-section bergaya potongan video. Saat pita ini melewati layar:
 * dua strip film menutup dari atas & bawah seperti rana, papan slate
 * "SC 0X · LABEL" muncul di tengah, kilatan putih menyapu saat rana tertutup
 * penuh, lalu rana terbuka lagi ke section berikutnya.
 *
 * Digerakkan posisi scroll (bukan waktu), jadi bisa dimundurkan. Hanya menulis
 * variabel CSS (--k tutup, --t posisi, --f kilat) — semua gerak di GPU.
 */
export default function SceneCut({ scene, label, tc }: { scene: string; label: string; tc: string }) {
  const level = useFxLevel();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (level === "off") { el.style.setProperty("--k", "0.85"); return; }
    let raf = 0, visible = false, last = "";
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    }, { rootMargin: "20% 0px" });
    const tick = () => {
      raf = visible ? requestAnimationFrame(tick) : 0;
      const r = el.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
      // rana menutup penuh saat pita tepat di tengah layar
      // (tertutup penuh sebentar di tengah, lalu terbuka lagi)
      const k = Math.min(1, Math.max(0, 1.3 - Math.abs(t - 0.5) * 3.2));
      const ke = k * k * (3 - 2 * k);
      const f = Math.max(0, (ke - 0.82) / 0.18);
      const v = `${t.toFixed(4)}|${ke.toFixed(4)}|${f.toFixed(3)}`;
      if (v === last) return;
      last = v;
      el.style.setProperty("--t", t.toFixed(4));
      el.style.setProperty("--k", ke.toFixed(4));
      el.style.setProperty("--f", f.toFixed(3));
    };
    io.observe(el);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [level]);

  return (
    <div ref={ref} className={styles.cut} aria-hidden="true">
      <div className={`${styles.bar} ${styles.top}`}><span className={styles.holes} /></div>
      <div className={`${styles.bar} ${styles.bottom}`}><span className={styles.holes} /></div>
      <div className={styles.slate}>
        <span className={styles.sc}>{scene}</span>
        <span className={styles.label}>{label}</span>
        <span className={styles.tc}>{tc}</span>
      </div>
      <span className={styles.flash} />
    </div>
  );
}
