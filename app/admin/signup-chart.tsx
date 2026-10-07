"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import styles from "./signup-chart.module.css";

type Ts = { _seconds: number } | null | undefined;
interface Row { createdAt?: Ts; accessGrantedAt?: Ts; analyticsGrantedAt?: Ts }

const DAYS = 30;
const DAY = 86_400_000;

function dayKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Pendaftaran (batang) dan aktivasi berbayar (titik) per hari, 30 hari
 * terakhir. Dihitung dari data user yang SUDAH dimuat panel — tanpa query
 * tambahan ke Firestore.
 *
 * Catatan: aktivasi memakai tanggal akses diberikan yang tersimpan; akses
 * yang dicabut lalu diberikan lagi hanya terhitung sekali (tanggal terakhir).
 */
export default function SignupChart({ users }: { users: Row[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const data = useMemo(() => {
    // "Hari ini" dibulatkan ke tengah malam lokal supaya batang stabil.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today.getTime() - (DAYS - 1) * DAY;
    const days = Array.from({ length: DAYS }, (_, i) => ({ ms: start + i * DAY, signups: 0, paid: 0 }));
    const index = new Map(days.map((d, i) => [dayKey(d.ms), i]));
    let prevSignups = 0;
    const prevStart = start - DAYS * DAY;
    for (const u of users) {
      const c = u.createdAt?._seconds ? u.createdAt._seconds * 1000 : 0;
      if (c) {
        const i = index.get(dayKey(c));
        if (i !== undefined) days[i].signups++;
        else if (c >= prevStart && c < start) prevSignups++;
      }
      for (const g of [u.accessGrantedAt, u.analyticsGrantedAt]) {
        const t = g?._seconds ? g._seconds * 1000 : 0;
        const i = t ? index.get(dayKey(t)) : undefined;
        if (i !== undefined) days[i].paid++;
      }
    }
    const total = days.reduce((n, d) => n + d.signups, 0);
    const paid = days.reduce((n, d) => n + d.paid, 0);
    const max = Math.max(1, ...days.map((d) => Math.max(d.signups, d.paid)));
    return { days, total, paid, max, prevSignups };
  }, [users]);

  const delta = data.prevSignups ? Math.round(((data.total - data.prevSignups) / data.prevSignups) * 100) : null;
  const h = hover !== null ? data.days[hover] : null;

  return (
    <div className={`card ${styles.chart}`}>
      <div className={styles.head}>
        <div>
          <div className={styles.k}>Pendaftaran · 30 hari</div>
          <div className={styles.big}>
            {data.total}
            {delta !== null && (
              <span className={delta >= 0 ? styles.up : styles.down}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
              </span>
            )}
          </div>
        </div>
        <div className={styles.legend}>
          <span><i className={styles.lgBar} /> Daftar</span>
          <span><i className={styles.lgDot} /> Aktivasi ({data.paid})</span>
        </div>
      </div>

      <div className={styles.plot} onPointerLeave={() => setHover(null)}>
        {data.days.map((d, i) => (
          <div key={d.ms} className={styles.col} onPointerEnter={() => setHover(i)} data-on={hover === i ? "1" : ""}>
            <motion.span
              className={styles.bar}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: d.signups / data.max }}
              transition={{ delay: i * 0.018, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
            {d.paid > 0 && (
              <motion.span
                className={styles.dot}
                style={{ bottom: `calc(${(d.paid / data.max) * 100}% - 4px)` }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6 + i * 0.018, type: "spring", stiffness: 400, damping: 18 }}
              />
            )}
          </div>
        ))}
        {h && (
          <div className={styles.tip} style={{ left: `${((hover ?? 0) + 0.5) * (100 / DAYS)}%` }}>
            <strong>{new Date(h.ms).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</strong>
            <span>{h.signups} daftar · {h.paid} aktivasi</span>
          </div>
        )}
      </div>
      <div className={styles.axis}>
        <span>{new Date(data.days[0].ms).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
        <span>Hari ini</span>
      </div>
    </div>
  );
}
