"use client";
import { motion } from "motion/react";
import { useFxLevel } from "./useFxLevel";
import styles from "./fx.module.css";

/**
 * Teks yang muncul per huruf dari balik "masker" — gaya judul film.
 * Pembaca layar membaca teks utuh lewat aria-label; span per huruf disembunyikan.
 * `lines` = array baris; tiap baris boleh punya kelas sendiri (misal shimmer).
 */
export default function SplitText({
  lines,
  className,
  delay = 0,
  stagger = 0.022,
  inView = false,
  waitIntro = false,
}: {
  lines: { text: string; className?: string }[];
  className?: string;
  delay?: number;
  stagger?: number;
  /** true = mulai saat terlihat (Motion, butuh JS).
   *  false = animasi CSS murni yang jalan sejak halaman dilukis — dipakai di
   *  hero supaya judul tidak tersembunyi menunggu JavaScript. */
  inView?: boolean;
  /** Tahan animasi CSS sampai intro landing selesai. */
  waitIntro?: boolean;
}) {
  const level = useFxLevel();
  const full = lines.map((l) => l.text).join(" ");

  if (level === "off") {
    return (
      <span className={className}>
        {lines.map((l, i) => (
          <span key={i} className={`${styles.splitLine} ${l.className ?? ""}`}>{l.text}</span>
        ))}
      </span>
    );
  }

  // Mode CSS: struktur sama, animasi lewat kelas + animation-delay inline.
  if (!inView) {
    let c = 0;
    return (
      <span className={`${className ?? ""} ${waitIntro ? "fx-wait-intro" : ""}`} aria-label={full}>
        {lines.map((l, li) => (
          <span key={li} className={`${styles.splitLine} ${l.className ?? ""}`} aria-hidden="true">
            {l.text.split(" ").map((word, wi, words) => (
              <span key={wi} className={styles.splitWord}>
                {Array.from(word).map((ch, ci) => (
                  <span
                    key={ci}
                    className={`${styles.splitChar} ${styles.splitCss}`}
                    style={{ animationDelay: `${delay + c++ * stagger}s` }}
                  >
                    {ch}
                  </span>
                ))}
                {wi < words.length - 1 && <span className={styles.splitSpace}> </span>}
              </span>
            ))}
          </span>
        ))}
      </span>
    );
  }

  let n = 0;
  const trigger = { initial: "hidden", whileInView: "show", viewport: { once: true, margin: "0px 0px -10% 0px" } };

  return (
    <motion.span className={className} aria-label={full} {...trigger}>
      {lines.map((l, li) => (
        <span key={li} className={`${styles.splitLine} ${l.className ?? ""}`} aria-hidden="true">
          {l.text.split(" ").map((word, wi, words) => (
            <span key={wi} className={styles.splitWord}>
              {Array.from(word).map((ch, ci) => {
                const i = n++;
                return (
                  <motion.span
                    key={ci}
                    className={styles.splitChar}
                    variants={{
                      hidden: { y: "110%", opacity: 0, rotateX: -60 },
                      show: {
                        y: "0%",
                        opacity: 1,
                        rotateX: 0,
                        transition: { delay: delay + i * stagger, duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                      },
                    }}
                  >
                    {ch}
                  </motion.span>
                );
              })}
              {wi < words.length - 1 && <span className={styles.splitSpace}> </span>}
            </span>
          ))}
        </span>
      ))}
    </motion.span>
  );
}
