"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePathname } from "next/navigation";
import { useFxLevel } from "./useFxLevel";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scroll (Lenis) yang disinkronkan dengan GSAP ScrollTrigger, hanya
 * untuk level "full". Di HP, scroll native jauh lebih baik — jangan diganti.
 *
 * Elemen yang punya scroll sendiri (terminal studio, tabel admin) harus diberi
 * atribut data-lenis-prevent supaya roda mouse tidak dibajak.
 */
export default function SmoothScroll() {
  const level = useFxLevel();
  const pathname = usePathname();

  useEffect(() => {
    if (level !== "full") return;
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      anchors: { offset: -90 },
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, [level]);

  // Pindah halaman: mulai dari atas, dan hitung ulang posisi trigger.
  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
    if (lenis) lenis.scrollTo(0, { immediate: true });
    const t = setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
