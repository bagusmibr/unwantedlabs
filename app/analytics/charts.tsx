"use client";
import { useState } from "react";
import styles from "./analytics.module.css";

/**
 * Dua grafik, keduanya satu seri saja.
 *
 * Catatan yang sengaja dipegang:
 *  - tidak ada sumbu ganda. Views dan engagement rate punya skala yang sama
 *    sekali berbeda; menumpuknya di satu grafik dengan dua sumbu adalah cara
 *    paling umum membuat grafik berbohong. ER muncul di tooltip, bukan sebagai
 *    garis kedua.
 *  - tidak ada angka di setiap titik. Hanya puncaknya yang diberi label; sisanya
 *    lewat hover.
 *  - grid dan sumbu dibuat samar; yang harus menonjol adalah datanya.
 */

const ACCENT = "#f59e0b";
const GRID = "rgba(255,255,255,0.07)";
const AXIS_TEXT = "rgba(255,255,255,0.35)";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

/* ── Grafik batang: pola jam & hari ──────────────────────────────────────── */

export interface BarDatum {
  label: string;
  videos: number;
  avgViews: number;
}

export function BarsChart({
  data,
  caption,
  labelEvery = 1,
}: {
  data: BarDatum[];
  caption: string;
  /** Tampilkan label sumbu X tiap N batang, supaya 24 jam tidak bertabrakan. */
  labelEvery?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 560;
  const H = 180;
  const padL = 12;
  const padR = 12;
  const padT = 18;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const max = Math.max(...data.map((d) => d.avgViews), 1);
  const slot = plotW / data.length;
  const barW = Math.max(3, slot - 4); // celah 4px antar batang
  const peak = data.reduce((best, d, i) => (d.avgViews > data[best].avgViews ? i : best), 0);
  const hasData = data.some((d) => d.videos > 0);

  return (
    <div className={styles.chartWrap}>
      {!hasData ? (
        <div className={styles.chartEmpty}>Belum ada data waktu unggah.</div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg} role="img" aria-label={caption}>
            {/* Garis dasar — satu-satunya garis grid yang benar-benar perlu */}
            <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke={GRID} strokeWidth="1" />

            {data.map((d, i) => {
              const h = d.avgViews > 0 ? Math.max(2, (d.avgViews / max) * plotH) : 0;
              const x = padL + i * slot + (slot - barW) / 2;
              const y = padT + plotH - h;
              const on = hover === i;
              return (
                <g key={d.label}>
                  {/* Area hover dibuat setinggi plot supaya batang pendek tetap mudah disentuh */}
                  <rect
                    x={padL + i * slot}
                    y={padT}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                  {h > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={Math.min(3, barW / 2)}
                      fill={ACCENT}
                      opacity={on || hover === null ? 1 : 0.35}
                      pointerEvents="none"
                    />
                  )}
                  {i % labelEvery === 0 && (
                    <text
                      x={padL + i * slot + slot / 2}
                      y={H - 9}
                      textAnchor="middle"
                      fontSize="9"
                      fill={AXIS_TEXT}
                      fontFamily="ui-monospace, monospace"
                      pointerEvents="none"
                    >
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Hanya puncaknya yang diberi label langsung */}
            {data[peak].avgViews > 0 && (
              <text
                x={padL + peak * slot + slot / 2}
                y={padT + plotH - Math.max(2, (data[peak].avgViews / max) * plotH) - 6}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={ACCENT}
                fontFamily="ui-monospace, monospace"
                pointerEvents="none"
              >
                {fmtNum(data[peak].avgViews)}
              </text>
            )}
          </svg>

          <div className={styles.chartFoot}>
            {hover !== null ? (
              <span>
                <b>{data[hover].label}</b> · {fmtNum(data[hover].avgViews)} views rata-rata ·{" "}
                {data[hover].videos} video
              </span>
            ) : (
              <span className={styles.chartHint}>{caption}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Grafik garis: tren per bulan ────────────────────────────────────────── */

export interface TrendDatum {
  label: string;
  avgViews: number;
  videos: number;
  avgER: number | null;
}

export function TrendChart({ points }: { points: TrendDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return <div className={styles.chartEmpty}>Belum ada data waktu unggah.</div>;
  }
  // Satu titik bukan tren — menggambar garis dari satu titik menyesatkan.
  if (points.length === 1) {
    const p = points[0];
    return (
      <div className={styles.chartEmpty}>
        Semua video ada di satu bulan ({p.label}) — belum cukup untuk melihat tren.
        Rata-rata {fmtNum(p.avgViews)} views dari {p.videos} video.
      </div>
    );
  }

  const W = 560;
  const H = 180;
  // Titik pertama dan terakhir duduk persis di tepi area plot, dan labelnya
  // rata tengah — tanpa ruang ini "Feb 26" terpotong jadi "eb 26".
  const padL = 30;
  const padR = 30;
  const padT = 22;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const max = Math.max(...points.map((p) => p.avgViews), 1);
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xy = (i: number, v: number) => ({
    x: padL + i * step,
    y: padT + plotH - (v / max) * plotH,
  });

  const line = points.map((p, i) => { const { x, y } = xy(i, p.avgViews); return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ");
  const area = `${line} L${(padL + (points.length - 1) * step).toFixed(1)},${padT + plotH} L${padL},${padT + plotH} Z`;
  const labelEvery = Math.ceil(points.length / 8);

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg} role="img" aria-label="Rata-rata views per bulan">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke={GRID} strokeWidth="1" />

        <path d={area} fill="url(#trendFill)" />
        <path d={line} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => {
          const { x, y } = xy(i, p.avgViews);
          const on = hover === i;
          return (
            <g key={p.label}>
              {on && <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke={GRID} strokeWidth="1" />}
              <circle cx={x} cy={y} r={on ? 5 : 3} fill={ACCENT} stroke="#0a0a0a" strokeWidth="2" pointerEvents="none" />
              <rect
                x={x - step / 2}
                y={padT}
                width={Math.max(step, 12)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {i % labelEvery === 0 && (
                <text x={x} y={H - 9} textAnchor="middle" fontSize="9" fill={AXIS_TEXT} fontFamily="ui-monospace, monospace" pointerEvents="none">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className={styles.chartFoot}>
        {hover !== null ? (
          <span>
            <b>{points[hover].label}</b> · {fmtNum(points[hover].avgViews)} views rata-rata ·{" "}
            {points[hover].videos} video
            {points[hover].avgER !== null && <> · ER {points[hover].avgER}%</>}
          </span>
        ) : (
          <span className={styles.chartHint}>Rata-rata views per bulan — arahkan kursor untuk detail</span>
        )}
      </div>
    </div>
  );
}
