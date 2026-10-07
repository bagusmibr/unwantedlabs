"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useFxLevel } from "@/components/fx/useFxLevel";

/**
 * template.tsx dipasang ulang setiap pindah halaman — tempat transisi masuk.
 * Halaman baru muncul dari blur + sedikit naik, seperti pergantian adegan.
 *
 * PENTING: transform/filter yang tertinggal di pembungkus ini menjadikannya
 * "containing block" untuk semua elemen position:fixed di dalamnya — navbar,
 * toast dan tombol WhatsApp akan ikut tergulir. Jadi keduanya dihapus total
 * begitu animasi selesai.
 */
// Muatan pertama TIDAK dianimasikan: konten hasil render server harus langsung
// terlihat tanpa menunggu JavaScript. Transisi hanya untuk navigasi berikutnya.
let hydrated = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const level = useFxLevel();
  const ref = useRef<HTMLDivElement>(null);
  const [first] = useState(() => !hydrated);
  useEffect(() => { hydrated = true; }, []);
  // Selalu motion.div (jangan ganti ke fragment saat "off"): mengganti jenis
  // pembungkus setelah hidrasi akan memasang ulang seluruh halaman.
  return (
    <motion.div
      ref={ref}
      // Tanpa animasi (muatan pertama / gerak dikurangi): JANGAN beri `animate`
      // sama sekali — Motion tetap akan menulis filter:blur(0px) ke style dan
      // onAnimationComplete tidak terpanggil, sehingga navbar ikut tergulir.
      initial={level === "off" || first ? false : { opacity: 0, filter: "blur(10px)", y: 14 }}
      animate={level === "off" || first ? undefined : { opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        const el = ref.current;
        if (!el) return;
        el.style.filter = "none";
        el.style.transform = "none";
      }}
    >
      {children}
    </motion.div>
  );
}
