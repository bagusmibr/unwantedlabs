"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import styles from "./Intro.module.css";

export const INTRO_KEY = "ul_intro_seen";

/**
 * Pembuka sinematik di kunjungan pertama per sesi: hitungan 000→100, logo
 * menyala, lalu tirai terbelah ke atas & bawah.
 *
 * Supaya tidak "berkedip" bagi yang sudah pernah melihat: skrip kecil di
 * app/layout.tsx memasang <html data-intro-seen> SEBELUM halaman dilukis, dan
 * CSS menyembunyikan overlay ini bila atribut itu ada (atau bila pengguna
 * memilih kurangi gerakan). Klik di mana saja untuk melewati.
 */
export default function Intro() {
  const root = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = root.current;
    const html = document.documentElement;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || html.dataset.introSeen || reduce) {
      // Sudah pernah lihat (atau gerak dikurangi): langsung lepas. Atribut
      // harus terpasang di semua jalur — animasi hero menunggu atribut ini.
      html.dataset.introSeen = "1";
      setDone(true);
      return;
    }
    sessionStorage.setItem(INTRO_KEY, "1");
    html.style.overflow = "hidden";

    const counter = { v: 0 };
    const q = gsap.utils.selector(el);
    const tl = gsap.timeline({
      onComplete: () => { html.style.overflow = ""; html.dataset.introSeen = "1"; setDone(true); },
    });
    tl.to(counter, {
      v: 100,
      duration: 1.3,
      ease: "power3.inOut",
      onUpdate: () => { if (num.current) num.current.textContent = String(Math.round(counter.v)).padStart(3, "0"); },
    })
      .fromTo(q("[data-logo]"), { autoAlpha: 0, scale: 0.92, filter: "blur(12px)" }, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "power3.out" }, 0.15)
      .to(q("[data-bar]"), { scaleX: 1, duration: 1.3, ease: "power3.inOut" }, 0)
      .to(q("[data-inner]"), { autoAlpha: 0, y: -20, duration: 0.35, ease: "power2.in" }, "+=0.15")
      .to(q("[data-top]"), { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "-=0.05")
      .to(q("[data-bot]"), { yPercent: 100, duration: 0.9, ease: "expo.inOut" }, "<");

    const skip = () => tl.progress(1);
    el.addEventListener("click", skip);
    // Pengaman: animasi GSAP berjalan di requestAnimationFrame, yang berhenti
    // di tab latar belakang. Apa pun yang terjadi, jangan pernah biarkan
    // pengunjung terjebak di balik overlay — paksa selesai setelah 4 dtk.
    const safety = setTimeout(skip, 4000);
    return () => {
      clearTimeout(safety);
      el.removeEventListener("click", skip);
      tl.kill();
      html.style.overflow = "";
    };
  }, []);

  if (done) return null;
  return (
    <div ref={root} className={styles.intro} aria-hidden="true">
      <div data-top className={`${styles.half} ${styles.top}`} />
      <div data-bot className={`${styles.half} ${styles.bot}`} />
      <div data-inner className={styles.inner}>
        <div data-logo className={styles.logo}>
          <Image src="/logo.png" alt="" width={360} height={56} priority />
        </div>
        <div className={styles.bar}><span data-bar /></div>
        <div className={styles.meta}>
          <span>Initializing engine</span>
          <span ref={num} className={styles.num}>000</span>
        </div>
      </div>
    </div>
  );
}
