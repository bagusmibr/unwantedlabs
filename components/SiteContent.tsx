"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLang } from "@/lib/lang";
import { EMPTY_SITE_CONTENT, pick, readSiteContent, type SiteContent } from "@/lib/site-content";
import styles from "./SiteContent.module.css";

/* Satu permintaan per muatan halaman, dipakai bersama semua komponen. */
let pending: Promise<SiteContent> | null = null;
function loadSiteContent(): Promise<SiteContent> {
  if (!pending) {
    pending = fetch("/api/site")
      .then((r) => r.json())
      .then((d) => (d?.ok ? readSiteContent(d.data) : EMPTY_SITE_CONTENT))
      .catch(() => EMPTY_SITE_CONTENT);
    // Boleh dimuat ulang di navigasi berikutnya (misal setelah admin menyimpan).
    setTimeout(() => { pending = null; }, 30_000);
  }
  return pending;
}

export function useSiteContent(): SiteContent | null {
  const [data, setData] = useState<SiteContent | null>(null);
  useEffect(() => {
    let alive = true;
    loadSiteContent().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);
  return data;
}

const DISMISS_KEY = "ul_ann_dismissed";

/** Banner tipis di puncak navbar. Ditutup = disimpan per versi pengumuman. */
export function AnnouncementBar() {
  const site = useSiteContent();
  const { lang } = useLang();
  const [dismissed, setDismissed] = useState<number | null>(null);

  useEffect(() => {
    const v = Number(localStorage.getItem(DISMISS_KEY));
    // Dibaca setelah mount karena localStorage tidak ada di server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(Number.isFinite(v) ? v : -1);
  }, []);

  const a = site?.announcement;
  const text = a ? pick(a.text, lang) : "";
  const show = !!a && a.active && !!text && dismissed !== null && dismissed !== a.version;

  return (
    <AnimatePresence initial={false}>
      {show && a && (
        <motion.div
          key={a.version}
          className={`${styles.bar} ${styles[`bar_${a.tone}`]}`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          role="region"
          aria-label={lang === "id" ? "Pengumuman" : "Announcement"}
        >
          <div className={styles.barInner}>
            <span className={styles.barDot} aria-hidden="true" />
            <span className={styles.barText}>{text}</span>
            {a.link && (
              <a
                href={a.link}
                className={styles.barLink}
                {...(a.link.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              >
                {pick(a.linkLabel, lang) || (lang === "id" ? "Selengkapnya" : "Learn more")} →
              </a>
            )}
            <button
              type="button"
              className={styles.barClose}
              aria-label={lang === "id" ? "Tutup pengumuman" : "Dismiss announcement"}
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, String(a.version));
                setDismissed(a.version);
              }}
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Dua video berdampingan dengan pemisah yang bisa digeser (mouse, sentuh,
 * keyboard). Kedua video diputar tersinkron. Hanya tampil bila admin
 * menyalakan demo dan mengisi kedua URL.
 */
export function BeforeAfter({ site }: { site: SiteContent | null }) {
  const { lang } = useLang();
  const wrap = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLVideoElement>(null);
  const after = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);

  const demo = site?.demo;
  const ready = !!demo && demo.visible && !!demo.beforeUrl && !!demo.afterUrl;

  // Jaga dua video tetap sinkron: "after" mengikuti waktu "before".
  useEffect(() => {
    if (!ready) return;
    const b = before.current, a = after.current;
    if (!b || !a) return;
    let raf = 0;
    const sync = () => {
      if (Math.abs(a.currentTime - b.currentTime) > 0.08) a.currentTime = b.currentTime;
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    // Hemat: hanya diputar selama terlihat.
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { void b.play().catch(() => {}); void a.play().catch(() => {}); }
      else { b.pause(); a.pause(); }
    }, { threshold: 0.25 });
    if (wrap.current) io.observe(wrap.current);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [ready]);

  if (!ready || !demo) return null;

  const setFromClient = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <figure className={styles.ba}>
      <div
        ref={wrap}
        className={`${styles.baStage} ${dragging ? styles.baDragging : ""}`}
        data-cursor={lang === "id" ? "Geser" : "Drag"}
        onPointerDown={(e) => { setDragging(true); (e.target as Element).setPointerCapture?.(e.pointerId); setFromClient(e.clientX); }}
        onPointerMove={(e) => { if (dragging) setFromClient(e.clientX); }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <video ref={before} className={styles.baVideo} src={demo.beforeUrl} muted loop playsInline preload="metadata" />
        <div className={styles.baClip} style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          <video ref={after} className={styles.baVideo} src={demo.afterUrl} muted loop playsInline preload="metadata" />
        </div>
        <span className={`${styles.baTag} ${styles.baTagL}`}>{demo.beforeLabel}</span>
        <span className={`${styles.baTag} ${styles.baTagR}`}>{demo.afterLabel}</span>
        <div className={styles.baHandle} style={{ left: `${pos}%` }}>
          <button
            type="button"
            className={styles.baKnob}
            role="slider"
            aria-label={lang === "id" ? "Geser perbandingan" : "Comparison slider"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
              if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
            }}
          >
            <span aria-hidden="true">‹ ›</span>
          </button>
        </div>
      </div>
      {pick(demo.caption, lang) && <figcaption className={styles.baCaption}>{pick(demo.caption, lang)}</figcaption>}
    </figure>
  );
}
