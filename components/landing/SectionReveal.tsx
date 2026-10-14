"use client";
import { useEffect } from "react";
import { useFxLevel } from "@/components/fx/useFxLevel";
import styles from "./SectionReveal.module.css";

/**
 * Transisi antar-section yang halus: isi tiap section ber-atribut
 * data-reveal muncul dari blur → tajam, naik pelan, dan sedikit membesar saat
 * pertama kali masuk layar. Sekali jalan per section (tidak berulang).
 *
 * Yang dianimasikan adalah ANAK section, bukan section-nya — section yang
 * di-pin GSAP (mis. showcase FPS) tetap aman karena posisinya tidak diubah.
 * Jangan pasang data-reveal pada section yang anaknya di-pin (Storyline).
 */
export default function SectionReveal() {
  const level = useFxLevel();

  useEffect(() => {
    if (level === "off") return;
    const secs = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        el.classList.add(styles.shown);
        io.unobserve(el);
        // setelah selesai, lepaskan filter/transform supaya tidak membebani
        window.setTimeout(() => el.classList.add(styles.done), 1600);
      });
    }, { rootMargin: "0px 0px -14% 0px" });
    secs.forEach((s) => {
      // section yang sudah terlihat saat halaman dibuka tidak disembunyikan
      const r = s.getBoundingClientRect();
      if (r.top < innerHeight * 0.86 && r.bottom > 0) return;
      s.classList.add(styles.armed);
      io.observe(s);
    });
    return () => io.disconnect();
  }, [level]);

  return null;
}
