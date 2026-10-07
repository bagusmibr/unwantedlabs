"use client";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import SplitText from "@/components/fx/SplitText";
import Scramble from "@/components/fx/Scramble";
import { EngineStatusPill } from "@/components/EngineStatus";
import styles from "./AuthShell.module.css";

// Three.js (~150 KB gzip) dimuat terpisah setelah halaman tampil — tidak ikut
// bundle awal, jadi tidak memperlambat munculnya konten.
const ParticleField = dynamic(() => import("@/components/fx/ParticleField"), { ssr: false });

/**
 * Bingkai halaman login & register: panel sinematik di kiri (desktop),
 * formulir di kanan. Di layar sempit panel kiri disembunyikan — formulir
 * adalah satu-satunya hal yang penting di HP.
 */
export default function AuthShell({
  eyebrow,
  lines,
  desc,
  children,
}: {
  eyebrow: string;
  lines: string[];
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <ParticleField variant="ambient" className={styles.particles} />
        <div className={styles.sideFade} aria-hidden="true" />
        <div className={styles.sideInner}>
          <Link href="/" className={styles.logo} aria-label="UNWANTED LABS — beranda">
            <Image src="/logo_small.png" alt="UNWANTED LABS" width={120} height={20} />
          </Link>
          <div className={styles.copy}>
            <span className="eyebrow"><Scramble text={eyebrow} /></span>
            <h1 className={styles.title}>
              <SplitText lines={lines.map((text, i) => ({ text, className: i > 0 ? styles.dim : undefined }))} delay={0.15} stagger={0.02} />
            </h1>
            <p className={styles.desc}>{desc}</p>
          </div>
          <EngineStatusPill />
        </div>
      </aside>
      <div className={styles.main}>{children}</div>
    </div>
  );
}
