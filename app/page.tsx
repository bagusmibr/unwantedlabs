"use client";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

interface Pricing {
  normalPrice: number;
  discountPrice: number;
  discountActive: boolean;
  discountLabel: string;
  waNumber: string;
}

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * ease));
      if (p < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return val;
}

const FEATURES = [
  { label: "Studio", title: "DUAL AUDIO Patch", desc: "Tambah track audio kedua ke metadata MP4 agar TikTok memproses video di jalur 120fps. Tidak ada re-encode — data video tidak tersentuh.", tag: "Berbayar" },
  { label: "Inspector", title: "Video Inspector", desc: "Analisis metadata video TikTok: judul, author, thumbnail, ukuran embed, dan Video ID. Gratis tanpa akun.", tag: "Gratis" },
  { label: "Lisensi", title: "Satu PC, Satu Akun", desc: "Sistem lisensi berbasis fingerprint perangkat. Satu akun hanya bisa aktif di satu komputer.", tag: "Terlindungi" },
];

const STEPS = [
  { n: "01", title: "Buat Akun", desc: "Daftar dengan email atau Google dalam hitungan detik." },
  { n: "02", title: "Hubungi Admin", desc: "Chat admin via WhatsApp untuk aktivasi akses berbayar." },
  { n: "03", title: "Drop Video", desc: "Upload MP4 ke studio — proses patch berjalan sepenuhnya di browser." },
  { n: "04", title: "Upload ke TikTok", desc: "Unduh hasil dan upload ke TikTok Studio seperti biasa." },
];

export default function HomePage() {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [visible, setVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Animated numbers — use 0 until visible
  const total = useCountUp(visible ? 120 : 0, 1400);

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((d) => d.ok && setPricing(d.data))
      .catch(() => {});

    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const waNumber = pricing?.waNumber || process.env.NEXT_PUBLIC_WA_NUMBER || "6281234567890";
  const waUrl = `https://wa.me/${waNumber}?text=Halo%2C%20saya%20ingin%20membeli%20akses%20UNWANTED%20LABS`;

  return (
    <>
      <Navbar />

      {/* Scan line effect */}
      <div className={styles.scanline} aria-hidden="true" />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={`wrap ${styles.heroInner}`}>
          {/* Logo besar */}
          <div className={`${styles.heroLogo} animate-in`}>
            <Image src="/logo.png" alt="UNWANTED" width={520} height={80} priority />
          </div>

          <div className={`${styles.heroDivider} animate-in`} style={{ animationDelay: "0.15s" }}>
            <div className={styles.heroDividerLine} />
            <span className={styles.heroDividerText}>TikTok Studio Tool</span>
            <div className={styles.heroDividerLine} />
          </div>

          <p className={`${styles.heroDesc} animate-in`} style={{ animationDelay: "0.25s" }}>
            Patch MP4 ke 120fps tanpa re-encode.<br />
            Analisis video TikTok secara mendalam.<br />
            Semua berjalan di browser — tidak ada upload ke server.
          </p>

          <div className={`${styles.heroCta} animate-in`} style={{ animationDelay: "0.35s" }}>
            <Link href="/register" className="btn">Mulai Sekarang</Link>
            <Link href="/inspector" className="btn btn-ghost">Inspector Gratis</Link>
          </div>
        </div>

        {/* Animated bottom rule */}
        <div className={styles.heroRule}>
          <div className={styles.heroRuleLine} />
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section className={`section-sm ${styles.statsSection}`}>
        <div className="wrap">
          <div ref={statsRef} className={`stat-grid stagger`}>
            <div className="stat-cell">
              <div className="k lbl">Max Frame Rate</div>
              <div className="v">{visible ? `${total}fps` : "—"}</div>
            </div>
            <div className="stat-cell">
              <div className="k lbl">Data Dikirim</div>
              <div className="v">{visible ? "0%" : "—"}</div>
            </div>
            <div className="stat-cell">
              <div className="k lbl">Per Lisensi</div>
              <div className="v">{visible ? "1 PC" : "—"}</div>
            </div>
            <div className="stat-cell">
              <div className="k lbl">Re-encode</div>
              <div className="v">{visible ? "Tidak" : "—"}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap"><div className="rule" /></div>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className={`lbl ${styles.sectionLbl} animate-in`}>Fitur Utama</div>
          <div className={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`${styles.featureCard} animate-in`} style={{ animationDelay: `${i * 80}ms` }}>
                <div className={styles.featureTop}>
                  <span className={`lbl ${styles.featureLbl}`}>{f.label}</span>
                  <span className={styles.featureTag}>{f.tag}</span>
                </div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="wrap"><div className="rule" /></div>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className={`lbl ${styles.sectionLbl} animate-in`}>Cara Kerja</div>
          <div className={styles.steps}>
            {STEPS.map((s, i) => (
              <div key={s.n} className={`${styles.step} animate-in`} style={{ animationDelay: `${i * 70}ms` }}>
                <div className={styles.stepNum}>{s.n}</div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="wrap"><div className="rule" /></div>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap-sm">
          <div className={`lbl ${styles.sectionLbl} animate-in`}>Harga</div>

          <div className={`${styles.pricingCard} animate-in`} style={{ animationDelay: "0.1s" }}>
            {pricing?.discountActive && (
              <div className={styles.discountTag}>{pricing.discountLabel || "Promo"}</div>
            )}

            <div className={styles.pricingPrice}>
              {pricing?.discountActive && pricing.discountPrice > 0 ? (
                <>
                  <span className={styles.pricingStrike}>Rp {(pricing.normalPrice || 0).toLocaleString("id-ID")}</span>
                  <span className={styles.pricingMain}>Rp {(pricing.discountPrice || 0).toLocaleString("id-ID")}</span>
                </>
              ) : (
                <span className={styles.pricingMain}>
                  {pricing && pricing.normalPrice > 0 ? `Rp ${pricing.normalPrice.toLocaleString("id-ID")}` : "Hubungi Admin"}
                </span>
              )}
              <span className={styles.pricingPer}>/lifetime</span>
            </div>

            <div className={styles.pricingDivider} />

            <ul className={styles.pricingList}>
              {[
                "DUAL AUDIO Patch — 120fps di TikTok",
                "Proses 100% di browser (privasi terjaga)",
                "Video Inspector gratis selamanya",
                "Update gratis seumur hidup",
                "1 PC per lisensi",
                "Support via WhatsApp",
              ].map((f) => (
                <li key={f} className={styles.pricingItem}>
                  <span className={styles.pricingCheck}>—</span>
                  {f}
                </li>
              ))}
            </ul>

            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn btn-wa" style={{ width: "100%", padding: 16, marginBottom: 12 }}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Beli via WhatsApp
            </a>
            <Link href="/register" className="btn btn-ghost" style={{ width: "100%", padding: 14 }}>
              Daftar Dulu
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className="wrap">
          <div className="rule-soft" />
          <div className={styles.footerInner}>
            <Image src="/logo_small.png" alt="UNWANTED" width={80} height={14} />
            <p className={styles.footerCopy}>
              Made by{" "}
              <a href="https://www.tiktok.com/@shiftedwalls" target="_blank" rel="noopener noreferrer">
                Bagus (Shifted) MIBR
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* WA Float */}
      <a href={waUrl} target="_blank" rel="noopener noreferrer" className="wa-float" title="Chat Admin via WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </>
  );
}
