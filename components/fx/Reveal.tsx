"use client";
import { motion, type Variants } from "motion/react";
import { useFxLevel } from "./useFxLevel";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Muncul saat masuk layar: naik + memudar + blur hilang. Sekali saja.
 * Level "off" → dirender diam tanpa animasi.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  style,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "section" | "li" | "span" | "p" | "h2" | "h3";
}) {
  const level = useFxLevel();
  const Tag = motion[as];
  // Tetap komponen yang sama saat "off" (initial={false}) — mengganti jenis
  // elemen setelah hidrasi akan memasang ulang isinya.
  return (
    <Tag
      className={className}
      style={style}
      initial={level === "off" ? false : { opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

const groupV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const itemV: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE } },
};

/** Anak-anak muncul bergantian. Bungkus setiap anak dengan <StaggerItem>. */
export function Stagger({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const level = useFxLevel();
  return (
    <motion.div className={className} style={style} variants={groupV} initial={level === "off" ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "0px 0px -8% 0px" }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <motion.div className={className} style={style} variants={itemV}>{children}</motion.div>;
}
