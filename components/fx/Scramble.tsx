"use client";
import { useEffect, useRef, useState } from "react";
import { useFxLevel } from "./useFxLevel";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%/<>_—";

/**
 * Teks "terdekripsi": huruf acak mengunci satu per satu ke teks asli.
 * Dipakai untuk label kecil (eyebrow, status) — bukan paragraf.
 * Mulai saat terlihat, dan diputar ulang setiap kali `text` berubah.
 */
export default function Scramble({ text, className, duration = 900 }: { text: string; className?: string; duration?: number }) {
  const level = useFxLevel();
  const [out, setOut] = useState(text);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (level === "off") return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let started = false;
    const run = () => {
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const locked = Math.floor(p * text.length);
        let s = "";
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          s += i < locked || c === " " ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        setOut(s);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started) { started = true; run(); io.disconnect(); }
    });
    io.observe(el);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [text, level, duration]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      <span aria-hidden="true">{level === "off" ? text : out}</span>
    </span>
  );
}
