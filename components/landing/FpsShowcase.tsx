"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLang } from "@/lib/lang";
import { useFxLevel } from "@/components/fx/useFxLevel";
import styles from "./FpsShowcase.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Tipografi kinetik + demo frame rate.
 *
 * Saat di-scroll (level "full": section menempel), angka besar berhitung
 * 24 → 30 → 60 → 120 dan kalimat di bawahnya berganti per huruf. Panel kanan
 * memperlihatkan bola yang BENAR-BENAR digambar pada frame rate tersebut
 * (posisi dibekukan per frame + jejak beberapa frame sebelumnya), jadi beda
 * kehalusannya terlihat langsung.
 *
 * Hanya membahas frame rate secara umum — tidak ada detail cara kerja engine.
 * Level "lite": tanpa pin, tahapan berganti otomatis saat terlihat.
 */

const STAGES = [24, 30, 60, 120];

export default function FpsShowcase() {
  const { lang } = useLang();
  const id = lang === "id";
  const level = useFxLevel();
  const root = useRef<HTMLElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef(0);
  const fpsRef = useRef(24);

  const WORDS = id
    ? ["Sinematik.", "Standar.", "Halus.", "Sangat halus."]
    : ["Cinematic.", "Standard.", "Smooth.", "Ultra smooth."];
  const SUBS = id
    ? ["Patah-patah saat gerakan cepat.", "Frame rate yang paling umum.", "Gerakan mulai terasa lancar.", "Setiap gerakan mulus — tanpa re-encode."]
    : ["Stutters on fast motion.", "The most common frame rate.", "Motion starts to feel fluid.", "Every motion fluid — zero re-encode."];

  // Ganti tahap: kelas aktif pada baris kata & titik progres
  const setStage = (s: number) => {
    if (s === stageRef.current && root.current?.dataset.stage === String(s)) return;
    stageRef.current = s;
    fpsRef.current = STAGES[s];
    if (root.current) root.current.dataset.stage = String(s);
  };

  // ── Demo bola: digambar pada frame rate tahap aktif ──────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0, visible = false, w = 0, h = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(cv);

    const PERIOD = 1.7; // detik untuk satu kali bolak-balik
    const pos = (t: number) => {
      const ph = (t % PERIOD) / PERIOD;
      const x = 0.08 + 0.84 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2));
      const y = 0.42 + Math.sin(ph * Math.PI * 4) * 0.16;
      return [x * w, y * h] as const;
    };
    const t0 = performance.now();
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || !w) return;
      const fps = fpsRef.current;
      const t = (now - t0) / 1000;
      const ts = Math.floor(t * fps) / fps; // waktu dibekukan per frame
      ctx.clearRect(0, 0, w, h);

      // lintasan
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const [x, y] = pos((i / 120) * PERIOD);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();

      // jejak frame sebelumnya (onion skin)
      for (let k = 6; k >= 1; k--) {
        const [x, y] = pos(ts - k / fps);
        ctx.fillStyle = `rgba(255,255,255,${(0.22 * (1 - k / 7)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      }
      const [bx, by] = pos(ts);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, 26);
      g.addColorStop(0, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill();

      // pita frame: satu garis per frame dalam jendela 1/2 detik
      const stripY = h - 34, n = Math.round(fps / 2), cur = Math.floor(t * fps) % n;
      for (let i = 0; i < n; i++) {
        const x = 16 + (i / n) * (w - 32);
        ctx.fillStyle = i === cur ? "#fff" : "rgba(255,255,255,0.22)";
        ctx.fillRect(x, stripY, Math.max(1, (w - 32) / n - 2), i === cur ? 18 : 12);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  // ── Penggerak tahap ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    setStage(0);
    if (numRef.current) numRef.current.textContent = "24";

    if (level === "full") {
      const ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: el,
          start: "top top",
          end: "+=260%",
          pin: true,
          scrub: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress * (STAGES.length - 1);    // 0..3
            // kata berganti tepat di tengah perguliran angka
            const s = Math.min(STAGES.length - 1, Math.round(p));
            // angka "menggulung" di antara dua tahap
            const i0 = Math.min(STAGES.length - 2, Math.floor(p));
            const f = Math.min(1, Math.max(0, (p - i0 - 0.25) / 0.5));
            const val = Math.round(STAGES[i0] + (STAGES[i0 + 1] - STAGES[i0]) * f);
            if (numRef.current) numRef.current.textContent = String(val);
            el.style.setProperty("--p", self.progress.toFixed(4));
            setStage(s);
          },
        });
      }, el);
      return () => ctx.revert();
    }

    // lite/off: berganti otomatis saat terlihat
    let iv = 0;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(iv);
      if (!e.isIntersecting || level === "off") return;
      iv = window.setInterval(() => {
        const s = (stageRef.current + 1) % STAGES.length;
        setStage(s);
        if (numRef.current) numRef.current.textContent = String(STAGES[s]);
      }, 2400);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { clearInterval(iv); io.disconnect(); };
  }, [level]);

  return (
    <section ref={root} className={styles.fps} data-morph="1" data-chapter="120 FPS" data-stage="0">
      <div className={`wrap ${styles.inner}`}>
        <div className={styles.left}>
          <span className="eyebrow">{id ? "Frame rate" : "Frame rate"}</span>
          <div className={styles.big} aria-hidden="true">
            <span ref={numRef} className={styles.num}>24</span>
            <span className={styles.unit}>FPS</span>
          </div>
          <div className={styles.words} aria-live="polite">
            {WORDS.map((w, i) => (
              <p key={w} className={styles.word} data-i={i}>
                {Array.from(w).map((ch, ci) => (
                  <span key={ci} style={{ transitionDelay: `${ci * 0.025}s` }}>{ch === " " ? " " : ch}</span>
                ))}
              </p>
            ))}
          </div>
          <div className={styles.subs}>
            {SUBS.map((s, i) => <p key={s} className={styles.sub} data-i={i}>{s}</p>)}
          </div>
          <ol className={styles.steps} aria-hidden="true">
            {STAGES.map((s, i) => <li key={s} data-i={i}><b>{s}</b><span /></li>)}
          </ol>
        </div>

        <div className={styles.panel} aria-hidden="true">
          <div className={styles.panelBar}>
            <span><i />PREVIEW</span>
            <span className={styles.panelFps}>
              {STAGES.map((s, i) => <b key={s} data-i={i}>{s} FPS</b>)}
            </span>
          </div>
          <canvas ref={canvasRef} className={styles.canvas} />
          <div className={styles.panelFoot}>
            <span>{id ? "1 garis = 1 frame" : "1 bar = 1 frame"}</span>
            <span>0.5 s</span>
          </div>
        </div>
      </div>
      <div className={styles.scrubBar} aria-hidden="true"><span /></div>
    </section>
  );
}
