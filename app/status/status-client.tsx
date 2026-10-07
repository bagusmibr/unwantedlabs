"use client";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { StatusDot, useEngineStatus } from "@/components/EngineStatus";
import { useLang } from "@/lib/lang";
import { STATE_META, fmtDateTime, statusMessage, timeAgo } from "@/lib/engine-status";
import styles from "./status-page.module.css";

export default function StatusClient() {
  const { lang } = useLang();
  const id = lang === "id";
  const { status, history } = useEngineStatus(true);

  const meta = status ? STATE_META[status.state] : null;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className="wrap-md">
          <div className={`${styles.head} animate-in`}>
            <span className="eyebrow">{id ? "Status Sistem" : "System Status"}</span>
            <h1 className={styles.title}>MP4 Patch Engine</h1>
            <p className={styles.sub}>
              {id
                ? "Halaman ini diperbarui otomatis. Saat TikTok mengubah sesuatu, kamu akan melihatnya di sini lebih dulu."
                : "This page updates automatically. When TikTok changes something, you'll see it here first."}
            </p>
          </div>

          {!status || !meta ? (
            <div className={`card ${styles.hero} ${styles.loading}`}>
              <div className="spinner" />
              <span>{id ? "Memuat status" : "Loading status"}</span>
            </div>
          ) : (
            <div className={`card ${styles.hero} ${styles[`tone_${meta.tone}`]} animate-in`}>
              <div className={styles.heroTop}>
                <StatusDot status={status} size={14} />
                <span className={styles.heroState}>{meta.label[lang]}</span>
                {status.blockEngine && (
                  <span className={styles.heroTag}>{id ? "Studio dikunci" : "Studio locked"}</span>
                )}
              </div>
              <p className={styles.heroMsg}>{statusMessage(status, lang)}</p>
              <div className={styles.heroMeta}>
                <div>
                  <span>{id ? "Terakhir diperbarui" : "Last updated"}</span>
                  <strong title={fmtDateTime(status.updatedAt, lang)}>{timeAgo(status.updatedAt, lang)}</strong>
                </div>
                {status.eta && status.state !== "online" && (
                  <div>
                    <span>{id ? "Perkiraan pulih" : "Expected back"}</span>
                    <strong>{fmtDateTime(status.eta, lang)}</strong>
                  </div>
                )}
                <div>
                  <span>Studio</span>
                  <strong>{status.blockEngine ? (id ? "Tidak tersedia" : "Unavailable") : (id ? "Bisa dipakai" : "Available")}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Penjelasan semua status supaya pelanggan paham artinya. */}
          <div className={styles.legendHead}>
            <span className="eyebrow">{id ? "Arti Status" : "What Each Status Means"}</span>
          </div>
          <div className={styles.legend}>
            {(Object.keys(STATE_META) as (keyof typeof STATE_META)[]).map((k) => {
              const m = STATE_META[k];
              return (
                <div key={k} className={`${styles.legendItem} ${styles[`tone_${m.tone}`]} ${status?.state === k ? styles.legendActive : ""}`}>
                  <span className={styles.legendDot} />
                  <div>
                    <div className={styles.legendLabel}>{m.label[lang]}</div>
                    <div className={styles.legendDesc}>{m.desc[lang]}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.legendHead}>
            <span className="eyebrow">{id ? "Riwayat" : "History"}</span>
          </div>
          {history.length === 0 ? (
            <p className={styles.empty}>{id ? "Belum ada perubahan status yang tercatat." : "No status changes recorded yet."}</p>
          ) : (
            <ol className={styles.timeline}>
              {history.map((h) => {
                const m = STATE_META[h.state];
                return (
                  <li key={h.id} className={`${styles.tlItem} ${styles[`tone_${m.tone}`]}`}>
                    <span className={styles.tlDot} />
                    <div className={styles.tlBody}>
                      <div className={styles.tlHead}>
                        <span className={styles.tlState}>{m.label[lang]}</span>
                        <span className={styles.tlTime}>{fmtDateTime(h.updatedAt, lang)}</span>
                      </div>
                      <p className={styles.tlMsg}>{statusMessage(h, lang)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className={styles.back}>
            <Link href="/" className="btn btn-ghost">{id ? "Kembali ke Beranda" : "Back to Home"}</Link>
          </div>
        </div>
      </main>
    </>
  );
}
