"use client";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import WaIcon from "@/components/WaIcon";
import { EngineStatusPill, StatusDot, useEngineStatus } from "@/components/EngineStatus";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { useLang } from "@/lib/lang";
import { STATE_META, statusMessage } from "@/lib/engine-status";

import { EMPTY_PRICING, effectivePrice, type PricingShape } from "@/lib/pricing";

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    // Nilai awal sudah 0, jadi tidak perlu setState sinkron di badan efek —
    // itu memicu render berantai dan ditolak lint React.
    if (target === 0) return;
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

export default function HomePage() {
  const { lang } = useLang();
  const id = lang === "id";
  const [pricing, setPricing] = useState<PricingShape>(EMPTY_PRICING);
  const [visible, setVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const { status } = useEngineStatus();

  const total = useCountUp(visible ? 120 : 0, 1400);

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((d) => { if (d?.ok && d.data) setPricing(d.data); })
      .catch(() => {});

    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const waNumber = pricing.waNumber || process.env.NEXT_PUBLIC_WA_NUMBER || "6281234567890";
  const wa = (text: string) => `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
  const waUrl = wa(id ? "Halo, saya ingin membeli akses UNWANTED LABS" : "Hi, I want to purchase access to UNWANTED LABS");

  // Pesan dibedakan per produk supaya begitu chat masuk kamu langsung tahu yang
  // mana yang dibeli, tanpa perlu bertanya lagi.
  const PRODUCTS = [
    {
      key: "mp4" as const,
      name: "MP4 Optimizer",
      tagline: id ? "120fps di TikTok tanpa re-encode" : "120fps on TikTok without re-encoding",
      features: [
        id ? "MP4 Optimizer — 120fps di TikTok" : "MP4 Optimizer — 120fps on TikTok",
        id ? "Proses 100% di browser (privasi terjaga)" : "100% browser-based processing (privacy secured)",
        id ? "Update gratis seumur hidup" : "Free lifetime updates",
        id ? "1 PC per lisensi" : "1 PC per license",
        id ? "Support via WhatsApp" : "Support via WhatsApp",
      ],
      waText: id
        ? "Halo, saya ingin membeli MP4 Optimizer (UNWANTED LABS)"
        : "Hi, I want to buy MP4 Optimizer (UNWANTED LABS)",
    },
    {
      key: "analytics" as const,
      name: "TikTok Analytics",
      tagline: id ? "Bedah performa akun TikTok mana pun" : "Break down any TikTok account's performance",
      features: [
        id ? "Analisis akun TikTok mana pun" : "Analyze any TikTok account",
        id ? "Views, likes, komentar, share per video" : "Views, likes, comments, shares per video",
        id ? "Ringkasan akun & tren per bulan" : "Account summary & monthly trend",
        id ? "Pola jam & hari posting terbaik" : "Best posting hour & day patterns",
        id ? "Ekspor ke Excel" : "Export to Excel",
      ],
      waText: id
        ? "Halo, saya ingin membeli TikTok Analytics (UNWANTED LABS)"
        : "Hi, I want to buy TikTok Analytics (UNWANTED LABS)",
    },
  ].filter((prod) => prod.key === "mp4" || pricing.analyticsVisible);

  const FEATURES = [
    {
      n: "01",
      label: "Studio",
      title: "MP4 Optimizer",
      desc: id
        ? "Optimasi file MP4 untuk performa terbaik di platform video. Proses berjalan 100% di browser — file tidak pernah meninggalkan perangkatmu."
        : "Optimize your MP4 files for best performance on video platforms. Runs 100% in your browser — files never leave your device.",
      tag: id ? "Berbayar" : "Paid",
    },
    {
      n: "02",
      label: "Inspector",
      title: "Video Inspector",
      desc: id
        ? "Analisis metadata video TikTok: judul, author, thumbnail, ukuran embed, dan Video ID. Gratis tanpa akun."
        : "Analyze TikTok video metadata: title, author, thumbnail, embed size, and Video ID. Free without an account.",
      tag: id ? "Gratis" : "Free",
    },
    {
      n: "03",
      label: id ? "Lisensi" : "License",
      title: id ? "Satu PC, Satu Akun" : "One PC, One Account",
      desc: id
        ? "Sistem lisensi berbasis fingerprint perangkat. Satu akun hanya bisa aktif di satu komputer."
        : "Device fingerprint-based license system. One account can only be active on one computer.",
      tag: id ? "Terlindungi" : "Protected",
    },
  ];

  const STEPS = [
    { n: "01", title: id ? "Buat Akun" : "Create Account", desc: id ? "Daftar dengan email atau Google dalam hitungan detik." : "Sign up with email or Google in seconds." },
    { n: "02", title: id ? "Hubungi Admin" : "Contact Admin", desc: id ? "Chat admin via WhatsApp untuk aktivasi akses berbayar." : "Chat admin via WhatsApp to activate paid access." },
    { n: "03", title: "Drop Video", desc: id ? "Upload MP4 ke studio — proses berjalan sepenuhnya di browser." : "Upload MP4 to the studio — processing runs entirely in your browser." },
    { n: "04", title: id ? "Upload ke TikTok" : "Upload to TikTok", desc: id ? "Unduh hasil dan upload ke TikTok Studio seperti biasa." : "Download the result and upload to TikTok Studio as usual." },
  ];

  // Setiap jawaban hanya menyatakan hal yang memang benar tentang produk ini
  // (lihat README) — tidak ada janji yang tidak bisa ditepati.
  const FAQ = [
    {
      q: id ? "Apakah videoku di-upload ke server?" : "Is my video uploaded to a server?",
      a: id
        ? "Tidak. Engine berjalan sepenuhnya di browser-mu. File video tidak pernah dikirim ke server kami."
        : "No. The engine runs entirely in your browser. Your video file is never sent to our servers.",
    },
    {
      q: id ? "Apakah kualitas video berubah?" : "Does the video quality change?",
      a: id
        ? "Tidak ada re-encode. Resolusi, bitrate, dan setiap frame tetap sama persis — yang diubah hanya struktur container MP4-nya."
        : "There's no re-encode. Resolution, bitrate and every frame stay exactly the same — only the MP4 container structure changes.",
    },
    {
      q: id ? "Video seperti apa yang didukung?" : "Which videos are supported?",
      a: id
        ? "File .mp4 yang punya track audio. Engine tidak menaikkan FPS — untuk hasil 120fps, video sumbernya harus sudah 120fps."
        : "An .mp4 file with an audio track. The engine doesn't raise the frame rate — for 120fps results, the source must already be 120fps.",
    },
    {
      q: id ? "Bagaimana kalau aku ganti komputer?" : "What if I change computers?",
      a: id
        ? "Satu lisensi berlaku untuk satu komputer. Chat admin via WhatsApp untuk reset perangkat."
        : "One license covers one computer. Message the admin on WhatsApp to reset your device.",
    },
    {
      q: id ? "Bagaimana kalau TikTok menutup metodenya?" : "What if TikTok closes the method?",
      a: id
        ? "Status engine selalu tampil live di halaman Status. Kalau metode di-patch, kami tandai di sana dan studio dikunci sementara supaya kamu tidak memproses video yang hasilnya pasti gagal."
        : "The engine status is always live on the Status page. If the method gets patched we flag it there and lock the studio, so you don't process videos that are bound to fail.",
    },
    {
      q: id ? "Bagaimana cara membeli?" : "How do I buy?",
      a: id
        ? "Daftar akun, lalu chat admin via WhatsApp. Setelah pembayaran dikonfirmasi, akses langsung diaktifkan di akunmu."
        : "Create an account, then message the admin on WhatsApp. Once payment is confirmed, access is activated on your account.",
    },
  ];

  const SOCIALS = [
    { platform: "Instagram", url: "https://instagram.com/bagusmibr", handle: "@bagusmibr" },
    { platform: "TikTok", url: "https://tiktok.com/@shiftedwalls", handle: "@shiftedwalls" },
    { platform: "YouTube", url: "https://youtube.com/@shiftedwalls", handle: "@shiftedwalls" },
  ];

  const engineDown = !!status && status.state !== "online";

  return (
    <>
      <Navbar />

      {/* Scan line effect */}
      <div className={styles.scanline} aria-hidden="true" />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={`wrap ${styles.heroInner}`}>
          <div className={`${styles.heroPill} animate-in`}>
            <EngineStatusPill status={status} />
          </div>

          <div className={`${styles.heroLogo} animate-in`} style={{ animationDelay: "0.08s" }}>
            <Image src="/logo.png" alt="UNWANTED" width={520} height={80} priority />
          </div>

          <div className={`${styles.heroDivider} animate-in`} style={{ animationDelay: "0.15s" }}>
            <div className={styles.heroDividerLine} />
            <span className={styles.heroDividerText}>TikTok Studio Tool</span>
            <div className={styles.heroDividerLine} />
          </div>

          <h1 className={`${styles.heroTitle} animate-in`} style={{ animationDelay: "0.2s" }}>
            {id ? <>120fps di TikTok.<br /><span>Tanpa re-encode.</span></> : <>120fps on TikTok.<br /><span>Zero re-encode.</span></>}
          </h1>

          <p className={`${styles.heroDesc} animate-in`} style={{ animationDelay: "0.28s" }}>
            {id
              ? "Optimasi MP4 langsung di browser — tidak ada upload ke server, tidak ada frame yang disentuh. Plus Video Inspector gratis untuk membedah video TikTok."
              : "Optimize MP4s right in your browser — no server uploads, not a single frame touched. Plus a free Video Inspector to dissect any TikTok video."}
          </p>

          <div className={`${styles.heroCta} animate-in`} style={{ animationDelay: "0.36s" }}>
            <Link href="/register" className="btn">
              {id ? "Mulai Sekarang" : "Get Started"}
            </Link>
            <Link href="/inspector" className="btn btn-ghost">
              {id ? "Inspector Gratis" : "Free Inspector"}
            </Link>
          </div>

          <div className={`${styles.heroTrust} animate-in`} style={{ animationDelay: "0.44s" }}>
            <span>{id ? "Proses lokal" : "Local processing"}</span>
            <span className={styles.heroTrustDot} />
            <span>{id ? "Bit-identik" : "Bit-identical"}</span>
            <span className={styles.heroTrustDot} />
            <span>{id ? "Lisensi seumur hidup" : "Lifetime license"}</span>
          </div>
        </div>

        <a href="#stats" className={styles.scrollCue} aria-label={id ? "Gulir ke bawah" : "Scroll down"}>
          <span />
        </a>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section id="stats" className={`section-sm ${styles.statsSection}`}>
        <div className="wrap">
          <div ref={statsRef} className={`${styles.statsGrid} stagger`}>
            {[
              { k: id ? "Maks Frame Rate" : "Max Frame Rate", v: visible ? `${total}` : "—", u: "fps" },
              { k: id ? "Data Dikirim" : "Data Sent", v: visible ? "0" : "—", u: "%" },
              { k: id ? "Per Lisensi" : "Per License", v: visible ? "1" : "—", u: "PC" },
              { k: "Re-encode", v: visible ? (id ? "Tidak" : "None") : "—", u: "" },
            ].map((s) => (
              <div key={s.k} className={`card ${styles.statCard}`}>
                <div className={styles.statK}>{s.k}</div>
                <div className={styles.statV}>
                  {s.v}
                  {s.u && <span className={styles.statU}>{s.u}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className="eyebrow">{id ? "Fitur Utama" : "Core Features"}</span>
            <h2 className={styles.sectionTitle}>{id ? "Semua yang kamu butuhkan, tanpa yang tidak perlu." : "Everything you need, nothing you don't."}</h2>
          </div>
          <div className={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`card ${styles.featureCard} animate-in`} style={{ animationDelay: `${i * 80}ms` }}>
                <div className={styles.featureTop}>
                  <span className={styles.featureNum}>{f.n}</span>
                  <span className={styles.featureTag}>{f.tag}</span>
                </div>
                <div className={`lbl ${styles.featureLbl}`}>{f.label}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className="eyebrow">{id ? "Cara Kerja" : "How It Works"}</span>
            <h2 className={styles.sectionTitle}>{id ? "Dari file mentah ke 120fps dalam empat langkah." : "From raw file to 120fps in four steps."}</h2>
          </div>
          <div className={styles.steps}>
            {STEPS.map((s, i) => (
              <div key={s.n} className={`${styles.step} animate-in`} style={{ animationDelay: `${i * 70}ms` }}>
                <div className={styles.stepNum}><span>{s.n}</span></div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section className="section" id="pricing">
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className="eyebrow">{id ? "Harga" : "Pricing"}</span>
            <h2 className={styles.sectionTitle}>{id ? "Bayar sekali. Pakai selamanya." : "Pay once. Use forever."}</h2>
          </div>

          {/* Jujur ke calon pembeli: kalau engine sedang tidak normal, mereka
              harus tahu SEBELUM membayar. */}
          {engineDown && status && (
            <Link href="/status" className={`${styles.engineNotice} ${styles[`tone_${STATE_META[status.state].tone}`]}`}>
              <StatusDot status={status} size={8} />
              <span className={styles.engineNoticeLabel}>Engine — {STATE_META[status.state].label[lang]}</span>
              <span className={styles.engineNoticeMsg}>{statusMessage(status, lang)}</span>
            </Link>
          )}

          {/* Satu kartu per produk. Kartu Analytics baru muncul setelah kamu
              menyalakannya di panel admin — jangan pajang tombol beli untuk
              sesuatu yang belum jalan. */}
          <div className={`${styles.pricingGrid} ${PRODUCTS.length === 1 ? styles.pricingGridSingle : ""}`}>
            {PRODUCTS.map((prod, i) => {
              const p = pricing[prod.key];
              const { price, strike } = effectivePrice(p);
              const saving = strike && price ? Math.round((1 - price / strike) * 100) : 0;
              return (
                <div key={prod.key} className={`${styles.pricingCard} ${i === 0 ? styles.pricingCardFeatured : ""} animate-in`} style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
                  {p.discountActive && (
                    <div className={styles.discountTag}>{p.discountLabel || (id ? "Promo" : "Sale")}</div>
                  )}

                  <div className={styles.pricingName}>{prod.name}</div>
                  <div className={styles.pricingTagline}>{prod.tagline}</div>

                  <div className={styles.pricingPrice}>
                    {strike !== null && (
                      <span className={styles.pricingStrike}>Rp {strike.toLocaleString("id-ID")}</span>
                    )}
                    <span className={styles.pricingMain}>
                      {price > 0 ? `Rp ${price.toLocaleString("id-ID")}` : (id ? "Hubungi Admin" : "Contact Admin")}
                    </span>
                    <span className={styles.pricingPer}>/lifetime</span>
                  </div>
                  {saving > 0 && (
                    <div className={styles.pricingSave}>{id ? `Hemat ${saving}%` : `Save ${saving}%`}</div>
                  )}

                  <div className={styles.pricingDivider} />

                  <ul className={styles.pricingList}>
                    {prod.features.map((f) => (
                      <li key={f} className={styles.pricingItem}>
                        <span className={styles.pricingCheck} aria-hidden="true">
                          <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={wa(prod.waText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-wa"
                    style={{ width: "100%", padding: 16, marginBottom: 12 }}
                  >
                    <WaIcon />
                    {id ? `Beli ${prod.name}` : `Buy ${prod.name}`}
                  </a>
                  <Link href="/register" className="btn btn-ghost" style={{ width: "100%", padding: 14 }}>
                    {id ? "Daftar Dulu" : "Register First"}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="section" id="faq">
        <div className="wrap">
          <div className={styles.faqLayout}>
            <div className={styles.sectionHead} style={{ marginBottom: 0 }}>
              <span className="eyebrow">FAQ</span>
              <h2 className={styles.sectionTitle}>{id ? "Pertanyaan yang sering muncul." : "Frequently asked."}</h2>
              <p className={styles.faqAside}>
                {id ? "Belum terjawab? " : "Still unsure? "}
                <a href={waUrl} target="_blank" rel="noopener noreferrer">{id ? "Tanya admin di WhatsApp" : "Ask the admin on WhatsApp"}</a>
              </p>
            </div>
            <div className={styles.faqList}>
              {FAQ.map((f) => (
                <details key={f.q} className={styles.faqItem}>
                  <summary className={styles.faqQ}>
                    <span>{f.q}</span>
                    <span className={styles.faqIcon} aria-hidden="true" />
                  </summary>
                  <p className={styles.faqA}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Support Creator ────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className={`card ${styles.creatorCard} animate-in`}>
            <div className={styles.creatorInner}>
              <div className={styles.creatorLeft}>
                <span className="eyebrow">{id ? "Kreator" : "Creator"}</span>
                <h3 className={styles.creatorHeading}>{id ? "Support Kreator" : "Support the Creator"}</h3>
                <p className={styles.creatorDesc}>
                  {id
                    ? "UNWANTED LABS dibuat oleh Bagus (Shifted) MIBR. Dukung terus karyanya di:"
                    : "UNWANTED LABS is made by Bagus (Shifted) MIBR. Follow and support his work at:"}
                </p>
              </div>
              <div className={styles.socialGrid}>
                {SOCIALS.map((s) => (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                    <span className={`lbl ${styles.socialPlatform}`}>{s.platform}</span>
                    <span className={styles.socialHandle}>{s.handle}</span>
                    <span className={styles.socialArrow} aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className="wrap">
          <div className="rule-soft" />
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <Image src="/logo_small.png" alt="UNWANTED" width={96} height={16} />
              <p>{id ? "Alat studio TikTok yang berjalan sepenuhnya di browser-mu." : "TikTok studio tools that run entirely in your browser."}</p>
              <EngineStatusPill status={status} />
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerHead}>{id ? "Produk" : "Product"}</div>
              <Link href="/dashboard">MP4 Studio</Link>
              <Link href="/inspector">Video Inspector</Link>
              <Link href="/status">{id ? "Status Engine" : "Engine Status"}</Link>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerHead}>{id ? "Akun" : "Account"}</div>
              <Link href="/login">{id ? "Masuk" : "Login"}</Link>
              <Link href="/register">{id ? "Daftar" : "Sign Up"}</Link>
              <a href="#faq">FAQ</a>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerHead}>{id ? "Kontak" : "Contact"}</div>
              <a href={waUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              {SOCIALS.map((s) => (
                <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer">{s.platform}</a>
              ))}
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} UNWANTED LABS</span>
            <span>
              {id ? "Dibuat oleh" : "Made by"}{" "}
              <a href="https://www.tiktok.com/@shiftedwalls" target="_blank" rel="noopener noreferrer">Bagus (Shifted) MIBR</a>
            </span>
          </div>
        </div>
      </footer>

      {/* WA Float */}
      <a href={waUrl} target="_blank" rel="noopener noreferrer" className="wa-float" title="Chat Admin via WhatsApp">
        <WaIcon size={22} />
      </a>
    </>
  );
}
