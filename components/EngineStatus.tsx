"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./EngineStatus.module.css";
import { useLang } from "@/lib/lang";
import {
  STATE_META,
  fmtDateTime,
  readEngineStatus,
  statusMessage,
  timeAgo,
  type EngineStatus,
  type EngineStatusLogEntry,
} from "@/lib/engine-status";

const POLL_MS = 60_000;

/**
 * Status engine dari /api/status, diperbarui tiap menit selama tab terbuka.
 * `null` = belum termuat (atau gagal) — komponen pemakai sebaiknya diam saja
 * daripada menebak "online".
 */
export function useEngineStatus(withHistory = false, enabled = true) {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [history, setHistory] = useState<EngineStatusLogEntry[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      fetch(`/api/status${withHistory ? "?history=1" : ""}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled || !d?.ok) return;
          setStatus(readEngineStatus(d.data));
          if (Array.isArray(d.history)) {
            setHistory(d.history.map((h: { id: string }) => ({ id: h.id, ...readEngineStatus(h) })));
          }
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, [withHistory, enabled]);

  return { status, history };
}

/** Titik berwarna sesuai status. `pulse` untuk status yang "hidup". */
export function StatusDot({ status, size = 8 }: { status: EngineStatus; size?: number }) {
  const tone = STATE_META[status.state].tone;
  return (
    <span
      className={`${styles.dot} ${styles[`tone_${tone}`]} ${tone === "ok" ? styles.dotPulse : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** Pill kecil "ENGINE · ONLINE" — tautan ke /status. */
export function EngineStatusPill({ status: given, className = "" }: { status?: EngineStatus | null; className?: string }) {
  const { lang } = useLang();
  // Bila pemanggil sudah punya status, pill tidak mengambil sendiri.
  const own = useEngineStatus(false, given === undefined);
  const status = given === undefined ? own.status : given;
  if (!status) return <span className={`${styles.pill} ${styles.pillGhost} ${className}`} aria-hidden="true" />;
  const meta = STATE_META[status.state];
  return (
    <Link href="/status" className={`${styles.pill} ${styles[`tone_${meta.tone}`]} ${className}`} title={statusMessage(status, lang)}>
      <StatusDot status={status} size={7} />
      <span className={styles.pillKey}>Engine</span>
      <span className={styles.pillSep} />
      <span className={styles.pillVal}>{meta.label[lang]}</span>
    </Link>
  );
}

/**
 * Banner lebar untuk studio / panel. Tidak tampil apa pun saat online kecuali
 * `showWhenOnline`.
 */
export function EngineStatusBanner({
  status,
  showWhenOnline = false,
  note,
}: {
  status: EngineStatus | null;
  showWhenOnline?: boolean;
  note?: React.ReactNode;
}) {
  const { lang } = useLang();
  const id = lang === "id";
  if (!status) return null;
  if (status.state === "online" && !showWhenOnline) return null;
  const meta = STATE_META[status.state];

  return (
    <div className={`${styles.banner} ${styles[`tone_${meta.tone}`]}`} role="status">
      <div className={styles.bannerHead}>
        <StatusDot status={status} size={9} />
        <span className={styles.bannerLabel}>Engine — {meta.label[lang]}</span>
        {status.blockEngine && <span className={styles.bannerTag}>{id ? "Studio dikunci" : "Studio locked"}</span>}
        {status.updatedAt && <span className={styles.bannerTime}>{timeAgo(status.updatedAt, lang)}</span>}
      </div>
      <p className={styles.bannerMsg}>{statusMessage(status, lang)}</p>
      {status.eta && status.state !== "online" && (
        <p className={styles.bannerEta}>
          {id ? "Perkiraan pulih" : "Expected back"}: <strong>{fmtDateTime(status.eta, lang)}</strong>
        </p>
      )}
      {note && <div className={styles.bannerNote}>{note}</div>}
    </div>
  );
}
