"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useFxLevel } from "@/components/fx/useFxLevel";
import styles from "./MetalWordmark.module.css";

/**
 * Wordmark "UNWANTED" berbahan metal krom yang bercahaya.
 *
 * Disusun dari beberapa lapis <text> SVG yang identik (bukan text-stroke —
 * stroke ikut menggambar kontur tumpang-tindih di dalam huruf):
 *   1. glow      — teks putih yang di-blur, berdenyut pelan
 *   2. extrude   — 8 salinan bergeser ke bawah dengan gradien gelap → tebal 3D
 *   3. rim       — salinan terang sedikit ke atas → tepi atas berkilat
 *   4. metal     — gradien krom (horizon terang di tengah, khas logam)
 *   5. sweep     — pita kilau yang menyapu dari kiri ke kanan berkala
 *   6. spot      — sorotan cahaya mengikuti kursor
 * Plus pantulan di "lantai" dan kilatan bintang kecil di tepi huruf.
 *
 * Gradien memakai userSpaceOnUse sehingga kilau mengalir mulus melintasi
 * semua huruf. Saat masuk layar, wordmark bangkit dari posisi miring (--e).
 *
 * Catatan: JANGAN memakai textLength. Chrome menghitungnya berbeda per lapis
 * bila SVG diskalakan, sehingga lapisan tergambar dengan lebar berbeda dan
 * hurufnya terlihat dobel. Teks memakai lebar alaminya; viewBox disesuaikan
 * dengan lebar terukur setelah font termuat.
 */

const WORD = "UNWANTED";
const BASE = 176;      // baseline teks di viewBox
const DEPTH = 8;       // tebal extrude (px viewBox)

export default function MetalWordmark() {
  const level = useFxLevel();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const spotRef = useRef<SVGRadialGradientElement>(null);
  const id = (n: string) => `${uid}-${n}`;
  // perkiraan awal (Inter 700, 200px); diukur ulang setelah font siap
  const [vb, setVb] = useState("-110 0 1220 220");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const t = el.querySelector<SVGTextElement>(`.${styles.metal}`);
      if (!t) return;
      const b = t.getBBox();
      if (b.width > 0) setVb(`${(b.x - 16).toFixed(1)} 0 ${(b.width + 32).toFixed(1)} 220`);
    };
    measure();
    if (document.fonts?.ready) document.fonts.ready.then(measure);
  }, []);
  const url = (n: string) => `url(#${id(n)})`;

  // Masuk layar (scroll) + sorotan kursor
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (level === "off") { el.style.setProperty("--e", "1"); return; }
    let raf = 0, visible = false, last = "";
    const tick = () => {
      raf = visible ? requestAnimationFrame(tick) : 0;
      const r = el.getBoundingClientRect();
      const e = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.75)));
      const eased = 1 - Math.pow(1 - e, 3);
      const v = eased.toFixed(4);
      if (v !== last) { last = v; el.style.setProperty("--e", v); }
    };
    const svg = el.querySelector<SVGSVGElement>(`.${styles.svg}`);
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
      // kilau SMIL dijeda saat tidak terlihat (hemat render)
      if (svg) { if (visible) svg.unpauseAnimations(); else svg.pauseAnimations(); }
    }, { rootMargin: "10% 0px" });
    io.observe(el);

    const spot = spotRef.current;
    const onMove = (ev: PointerEvent) => {
      if (!spot || !svg) return;
      const b = svg.getBoundingClientRect();
      const v = svg.viewBox.baseVal;
      spot.setAttribute("cx", String(v.x + ((ev.clientX - b.left) / b.width) * v.width));
      spot.setAttribute("cy", String(((ev.clientY - b.top) / b.height) * 220));
      el.dataset.hover = "1";
    };
    const onLeave = () => { delete el.dataset.hover; };
    if (level === "full") {
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    }
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [level]);

  const text = (props: React.SVGProps<SVGTextElement>, key?: string | number) => (
    <text
      key={key}
      x="500"
      y={BASE}
      textAnchor="middle"
      className={styles.t}
      {...props}
    >
      {WORD}
    </text>
  );

  return (
    <div ref={ref} className={styles.wm} aria-hidden="true">
      <div className={styles.floorGlow} />
      <div className={styles.tilt}>
        {/* glow: lapisan terpisah yang di-blur sekali lalu hanya diubah
            opacity-nya (murah) — bukan filter yang dihitung ulang per frame */}
        <div className={styles.glowWrap}>
          <svg viewBox={vb} className={styles.glow} overflow="visible">
            {text({ fill: "#fff" })}
          </svg>
        </div>
        <svg viewBox={vb} className={styles.svg} overflow="visible">
          <defs>
            <linearGradient id={id("chrome")} gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2={BASE}>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.2" stopColor="#ececec" />
              <stop offset="0.44" stopColor="#8a8a8a" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="0.54" stopColor="#3f3f3f" />
              <stop offset="0.76" stopColor="#a3a3a3" />
              <stop offset="1" stopColor="#efefef" />
            </linearGradient>
            <linearGradient id={id("side")} gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2={BASE + DEPTH}>
              <stop offset="0" stopColor="#5c5c5c" />
              <stop offset="1" stopColor="#161616" />
            </linearGradient>
            <linearGradient id={id("sweep")} gradientUnits="userSpaceOnUse" x1="-260" y1="0" x2="-60" y2="60">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
              {level !== "off" && (
                <animateTransform
                  attributeName="gradientTransform"
                  type="translate"
                  values="0 0; 1500 0; 1500 0"
                  keyTimes="0; 0.45; 1"
                  dur="5.5s"
                  repeatCount="indefinite"
                />
              )}
            </linearGradient>
            <radialGradient ref={spotRef} id={id("spot")} gradientUnits="userSpaceOnUse" cx="500" cy="110" r="190">
              <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0.18" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g>
            {Array.from({ length: DEPTH }, (_, i) => text({ y: BASE + DEPTH - i, fill: url("side") }, i))}
          </g>
          {text({ y: BASE - 1.6, fill: "rgba(255,255,255,0.95)" })}
          {text({ fill: url("chrome"), className: `${styles.t} ${styles.metal}` })}
          {text({ fill: url("sweep"), className: `${styles.t} ${styles.sweep}` })}
          {text({ fill: url("spot"), className: `${styles.t} ${styles.spot}` })}

          {/* kilatan bintang di tepi huruf */}
          {[[96, 38, 0], [512, 34, 1.6], [880, 44, 3.1], [300, 176, 4.2]].map(([x, y, d], i) => (
            <path
              key={i}
              className={styles.glint}
              style={{ animationDelay: `${d}s`, transformOrigin: `${x}px ${y}px` }}
              d={`M${x} ${y - 14} L${x + 2.2} ${y - 2.2} L${x + 14} ${y} L${x + 2.2} ${y + 2.2} L${x} ${y + 14} L${x - 2.2} ${y + 2.2} L${x - 14} ${y} L${x - 2.2} ${y - 2.2} Z`}
              fill="#fff"
            />
          ))}
        </svg>

        {/* pantulan di lantai */}
        <svg viewBox={vb} className={styles.reflect} overflow="visible">
          {text({ fill: url("chrome") })}
        </svg>
      </div>
    </div>
  );
}
