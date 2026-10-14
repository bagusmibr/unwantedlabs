"use client";
import { useEffect, useId, useRef } from "react";
import { useFxLevel } from "@/components/fx/useFxLevel";
import { LOGO_BOX, LOGO_PATH } from "./logoPath";
import styles from "./MetalWordmark.module.css";

/**
 * Logo UNWANTED raksasa berbahan metal krom yang bercahaya (penutup landing).
 *
 * Bentuknya = logo asli (public/logo.png) yang sudah diubah ke path vektor
 * (logoPath.ts), disusun dari beberapa lapis path yang identik:
 *   1. glow      — salinan putih yang di-blur, berdenyut pelan (lapisan HTML
 *                  terpisah: di-blur sekali, lalu hanya opacity yang berubah)
 *   2. extrude   — salinan bergeser ke bawah dengan gradien gelap → tebal 3D
 *   3. rim       — salinan terang sedikit ke atas → tepi atas berkilat
 *   4. metal     — gradien krom (horizon terang di tengah, khas logam)
 *   5. sweep     — pita kilau yang menyapu dari kiri ke kanan berkala
 *   6. spot      — sorotan cahaya mengikuti kursor
 * Plus pantulan di "lantai" dan kilatan bintang kecil di tepi huruf.
 *
 * Gradien memakai userSpaceOnUse sehingga kilau mengalir mulus melintasi
 * semua huruf. Saat masuk layar, logo bangkit dari posisi miring (--e).
 */

const { x: BX, y: BY, w: BW, h: BH } = LOGO_BOX;
const PAD = 24;
const VIEWBOX = `${BX - PAD} ${BY - PAD} ${BW + PAD * 2} ${BH + PAD * 2}`;
const DEPTH = 7; // tebal extrude (satuan viewBox)
const GLINTS: [number, number, number][] = [
  [BX + BW * 0.06, BY + 1, 0],
  [BX + BW * 0.47, BY + 1, 1.7],
  [BX + BW * 0.9, BY + 2, 3.2],
  [BX + BW * 0.3, BY + BH - 1, 4.3],
];

export default function MetalWordmark() {
  const level = useFxLevel();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const spotRef = useRef<SVGRadialGradientElement>(null);
  const id = (n: string) => `${uid}-${n}`;
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
      const v = (1 - Math.pow(1 - e, 3)).toFixed(4);
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
      spot.setAttribute("cy", String(v.y + ((ev.clientY - b.top) / b.height) * v.height));
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

  const logo = (props: React.SVGProps<SVGPathElement>, key?: string | number) => (
    <path key={key} d={LOGO_PATH} fillRule="evenodd" {...props} />
  );

  return (
    <div ref={ref} className={styles.wm} aria-hidden="true">
      <div className={styles.floorGlow} />
      <div className={styles.tilt}>
        <div className={styles.glowWrap}>
          <svg viewBox={VIEWBOX} className={styles.glow}>{logo({ fill: "#fff" })}</svg>
        </div>

        <svg viewBox={VIEWBOX} className={styles.svg} overflow="visible">
          <defs>
            <linearGradient id={id("chrome")} gradientUnits="userSpaceOnUse" x1="0" y1={BY} x2="0" y2={BY + BH}>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.2" stopColor="#ececec" />
              <stop offset="0.44" stopColor="#8a8a8a" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="0.55" stopColor="#3f3f3f" />
              <stop offset="0.78" stopColor="#a3a3a3" />
              <stop offset="1" stopColor="#efefef" />
            </linearGradient>
            <linearGradient id={id("side")} gradientUnits="userSpaceOnUse" x1="0" y1={BY} x2="0" y2={BY + BH + DEPTH}>
              <stop offset="0" stopColor="#5c5c5c" />
              <stop offset="1" stopColor="#141414" />
            </linearGradient>
            <linearGradient id={id("sweep")} gradientUnits="userSpaceOnUse" x1={BX - 170} y1="0" x2={BX - 50} y2="40">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
              {level !== "off" && (
                <animateTransform
                  attributeName="gradientTransform"
                  type="translate"
                  values={`0 0; ${BW + 260} 0; ${BW + 260} 0`}
                  keyTimes="0; 0.45; 1"
                  dur="5.5s"
                  repeatCount="indefinite"
                />
              )}
            </linearGradient>
            <radialGradient ref={spotRef} id={id("spot")} gradientUnits="userSpaceOnUse" cx={BX + BW / 2} cy={BY + BH / 2} r="110">
              <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0.2" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g>
            {Array.from({ length: DEPTH }, (_, i) =>
              logo({ transform: `translate(0 ${DEPTH - i})`, fill: url("side") }, i))}
          </g>
          {logo({ transform: "translate(0 -0.9)", fill: "rgba(255,255,255,0.95)" })}
          {logo({ fill: url("chrome") })}
          {logo({ fill: url("sweep"), className: styles.sweep })}
          {logo({ fill: url("spot"), className: styles.spot })}

          {GLINTS.map(([x, y, d], i) => (
            <path
              key={i}
              className={styles.glint}
              style={{ animationDelay: `${d}s`, transformOrigin: `${x}px ${y}px` }}
              d={`M${x} ${y - 9} L${x + 1.4} ${y - 1.4} L${x + 9} ${y} L${x + 1.4} ${y + 1.4} L${x} ${y + 9} L${x - 1.4} ${y + 1.4} L${x - 9} ${y} L${x - 1.4} ${y - 1.4} Z`}
              fill="#fff"
            />
          ))}
        </svg>

        {/* pantulan di lantai */}
        <svg viewBox={VIEWBOX} className={styles.reflect}>{logo({ fill: url("chrome") })}</svg>
      </div>
    </div>
  );
}
