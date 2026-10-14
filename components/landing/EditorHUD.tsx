"use client";
import { useEffect, useRef, useState } from "react";
import { useFxLevel } from "@/components/fx/useFxLevel";
import styles from "./EditorHUD.module.css";

/**
 * Antarmuka "software editing video" di atas landing:
 *
 *  - HeroViewfinder : bingkai kamera di hero (sudut fokus, ● REC + timecode
 *                     berjalan pada 120 fps, info kamera, garis bantu).
 *  - EditorTimeline : timeline melayang di bawah layar. Tiap section ber-
 *                     atribut data-chapter jadi satu klip; playhead mengikuti
 *                     posisi scroll dan timecode ikut ter-scrub. Klik klip
 *                     untuk melompat ke section itu.
 *
 * Murni hiasan: aria-hidden, dan timeline hanya tampil di layar lebar dengan
 * level efek "full".
 */

const FPS = 120;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
/** detik → HH:MM:SS:FFF (frame 0–119) */
function timecode(sec: number) {
  const s = Math.max(0, sec);
  const f = Math.floor((s % 1) * FPS);
  const t = Math.floor(s);
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}:${pad(f, 3)}`;
}

export function HeroViewfinder() {
  const level = useFxLevel();
  const tcRef = useRef<HTMLSpanElement>(null);

  // Timecode berjalan real-time (berhenti saat tab disembunyikan)
  useEffect(() => {
    if (level === "off") return;
    const t0 = performance.now();
    let raf = 0, last = "";
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = timecode((now - t0) / 1000);
      if (s !== last && tcRef.current) { last = s; tcRef.current.textContent = s; }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level]);

  return (
    <div className={`${styles.vf} fx-wait-intro`} aria-hidden="true">
      <span className={`${styles.corner} ${styles.tl}`} />
      <span className={`${styles.corner} ${styles.tr}`} />
      <span className={`${styles.corner} ${styles.bl}`} />
      <span className={`${styles.corner} ${styles.br}`} />
      <div className={`${styles.vfRow} ${styles.vfTop}`}>
        <span className={styles.rec}><i />REC <span ref={tcRef}>00:00:00:000</span></span>
        <span className={styles.vfMeta}>4K <b>·</b> 120 FPS <b>·</b> HDR</span>
      </div>
      <div className={`${styles.vfRow} ${styles.vfBottom}`}>
        <span className={styles.vfMeta}>ISO 800 <b>·</b> 1/240 <b>·</b> f/1.8</span>
        <span className={styles.battery}><i /><i /><i /><i /></span>
      </div>
      <span className={styles.thirds} />
      <span className={styles.focus} />
    </div>
  );
}

type Chapter = { el: HTMLElement; label: string; start: number; len: number };

export function EditorTimeline() {
  const level = useFxLevel();
  const [chapters, setChapters] = useState<{ label: string; left: number; width: number }[]>([]);
  const [active, setActive] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const chRef = useRef<Chapter[]>([]);

  useEffect(() => {
    if (level !== "full") return;

    // Posisi section dalam dokumen. Section yang di-pin GSAP dibungkus
    // .pin-spacer — ukur pembungkusnya supaya durasi pin ikut terhitung.
    const measure = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const list: Chapter[] = els.map((el) => {
        const box = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el;
        const start = box.getBoundingClientRect().top + scrollY;
        return { el, label: el.dataset.chapter || "", start, len: 0 };
      });
      list.forEach((c, i) => {
        const next = list[i + 1] ? list[i + 1].start : max + innerHeight;
        c.len = Math.max(1, next - c.start);
      });
      chRef.current = list;
      const total = list.reduce((a, c) => a + c.len, 0) || 1;
      let acc = 0;
      setChapters(list.map((c) => {
        const left = acc / total;
        acc += c.len;
        return { label: c.label, left, width: c.len / total };
      }));
    };
    measure();
    const iv = setInterval(measure, 2500);
    addEventListener("resize", measure);

    let raf = 0, lastTc = "", lastActive = -1, lastShow = "";
    const DURATION = 60; // halaman = klip 60 detik
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const p = Math.min(1, Math.max(0, scrollY / max));
      if (headRef.current) headRef.current.style.transform = `translate3d(${(p * 100).toFixed(3)}cqw, 0, 0)`;
      const tc = timecode(p * DURATION);
      if (tc !== lastTc && tcRef.current) { lastTc = tc; tcRef.current.textContent = tc; }
      const c = innerHeight * 0.5;
      let a = 0;
      chRef.current.forEach((ch, i) => { if (ch.start - scrollY < c) a = i; });
      if (a !== lastActive) { lastActive = a; setActive(a); }
      // muncul setelah hero, menghilang menjelang footer
      const show = scrollY > innerHeight * 0.45 && p < 0.985 ? "1" : "0";
      if (show !== lastShow && barRef.current) { lastShow = show; barRef.current.dataset.show = show; }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); removeEventListener("resize", measure); };
  }, [level]);

  if (level !== "full") return null;

  const jump = (i: number) => {
    const ch = chRef.current[i];
    if (!ch) return;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: number, o?: object) => void } }).__lenis;
    const y = ch.start + 2;
    if (lenis) lenis.scrollTo(y, { duration: 1.4 }); else scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <div ref={barRef} className={styles.timeline} data-show="0" aria-hidden="true">
      <div className={styles.tlInfo}>
        <span className={styles.rec}><i />PLAY</span>
        <span ref={tcRef} className={styles.tlTc}>00:00:00:000</span>
        <span className={styles.tlFps}>120<small>FPS</small></span>
      </div>
      <div className={styles.tlTrack}>
        <div className={styles.ruler} />
        <div className={styles.clips}>
          {chapters.map((c, i) => (
            <button
              key={c.label + i}
              type="button"
              tabIndex={-1}
              className={`${styles.clip} ${i === active ? styles.clipOn : ""}`}
              style={{ left: `${c.left * 100}%`, width: `${c.width * 100}%` }}
              onClick={() => jump(i)}
              data-cursor={c.label}
            >
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.wave}>
          {Array.from({ length: 56 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${-((i * 37) % 23) / 10}s`, height: `${30 + ((i * 53) % 61)}%` }} />
          ))}
        </div>
        <span ref={headRef} className={styles.head} />
      </div>
    </div>
  );
}
