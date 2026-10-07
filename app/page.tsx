"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Navbar from "@/components/Navbar";
import WaIcon from "@/components/WaIcon";
import { EngineStatusPill, StatusDot, useEngineStatus } from "@/components/EngineStatus";
import { BeforeAfter, useSiteContent } from "@/components/SiteContent";
import dynamic from "next/dynamic";
import SplitText from "@/components/fx/SplitText";
import Scramble from "@/components/fx/Scramble";
import Tilt from "@/components/fx/Tilt";
import Magnetic from "@/components/fx/Magnetic";
import { Reveal, Stagger, StaggerItem } from "@/components/fx/Reveal";
import { CountUp, Marquee } from "@/components/fx/misc";
import Storyline from "@/components/landing/Storyline";
import Intro from "@/components/landing/Intro";
import styles from "./page.module.css";
import { useLang } from "@/lib/lang";
import { STATE_META, statusMessage } from "@/lib/engine-status";
import { EMPTY_PRICING, effectivePrice, type PricingShape } from "@/lib/pricing";

// Three.js (~150 KB gzip) dimuat terpisah setelah halaman tampil — tidak ikut
// bundle awal, jadi tidak memperlambat munculnya konten.
const ParticleField = dynamic(() => import("@/components/fx/ParticleField"), { ssr: false });

/** Judul seksi: label terdekripsi + judul yang muncul per huruf. */
function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <span className="eyebrow"><Scramble text={eyebrow} /></span>
      <h2 className={styles.sectionTitle}>
        <SplitText lines={[{ text: title }]} inView stagger={0.012} />
      </h2>
      {children}
    </div>
  );
}

export default function HomePage() {
  const { lang } = useLang();
  const id = lang === "id";
  const [pricing, setPricing] = useState<PricingShape>(EMPTY_PRICING);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { status } = useEngineStatus();
  const site = useSiteContent();

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((d) => { if (d?.ok && d.data) setPricing(d.data); })
      .catch(() => {});
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
        ? "Tidak ada re-encode. Resolusi, bitrate, dan setiap frame videomu tetap sama persis."
        : "There's no re-encode. Resolution, bitrate and every frame of your video stay exactly the same.",
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

  const MARQUEE = id
    ? ["120 fps", "Tanpa re-encode", "100% di browser", "Bit-identik", "Lisensi seumur hidup", "Privasi terjaga"]
    : ["120 fps", "Zero re-encode", "100% in-browser", "Bit-identical", "Lifetime license", "Private by design"];

  const engineDown = !!status && status.state !== "online";
  const demoReady = !!site?.demo.visible && !!site.demo.beforeUrl && !!site.demo.afterUrl;

  return (
    <>
      <Intro />
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <ParticleField className={styles.heroParticles} />
        <div className={styles.heroVignette} aria-hidden="true" />

        <div className={`wrap ${styles.heroInner}`}>
          {/* Hero memakai animasi CSS (fx-rise), bukan Motion: harus terlihat
              begitu HTML tiba, tanpa menunggu JavaScript. fx-wait-intro
              menahannya sampai tirai intro terbuka. */}
          <div className={`${styles.heroPill} fx-rise fx-wait-intro`}>
            <EngineStatusPill status={status} />
          </div>

          <div className={`${styles.heroLogo} fx-rise fx-wait-intro`} style={{ animationDelay: "0.1s" }}>
            <Image src="/logo.png" alt="UNWANTED" width={520} height={80} priority />
            <span className={styles.logoScan} aria-hidden="true" />
          </div>

          <div className={`${styles.heroDivider} fx-wait-intro`}>
            <div className={styles.heroDividerLine} />
            <span className={styles.heroDividerText}><Scramble text="TikTok Studio Tool" /></span>
            <div className={styles.heroDividerLine} />
          </div>

          <h1 className={styles.heroTitle}>
            <SplitText
              waitIntro
              delay={0.35}
              lines={id
                ? [{ text: "120fps di TikTok." }, { text: "Tanpa re-encode.", className: styles.shimmer }]
                : [{ text: "120fps on TikTok." }, { text: "Zero re-encode.", className: styles.shimmer }]}
            />
          </h1>

          <p className={`${styles.heroDesc} fx-rise fx-wait-intro`} style={{ animationDelay: "0.9s" }}>
            {id
              ? "Optimasi MP4 langsung di browser — tidak ada upload ke server, tidak ada frame yang disentuh. Plus Video Inspector gratis untuk membedah video TikTok."
              : "Optimize MP4s right in your browser — no server uploads, not a single frame touched. Plus a free Video Inspector to dissect any TikTok video."}
          </p>

          <div className={`${styles.heroCta} fx-rise fx-wait-intro`} style={{ animationDelay: "1.05s" }}>
            <Magnetic>
              <Link href="/register" className={`btn ${styles.ctaPrimary}`} data-cursor={id ? "Mulai" : "Start"}>
                <span className={styles.ctaShine} aria-hidden="true" />
                {id ? "Mulai Sekarang" : "Get Started"}
              </Link>
            </Magnetic>
            <Magnetic>
              <Link href="/inspector" className="btn btn-ghost">
                {id ? "Inspector Gratis" : "Free Inspector"}
              </Link>
            </Magnetic>
          </div>

          <div className={`${styles.heroTrust} fx-rise fx-wait-intro`} style={{ animationDelay: "1.2s" }}>
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

      {/* ── Marquee ───────────────────────────────────────────────────────── */}
      <section className={styles.marqueeSection} aria-label={id ? "Keunggulan" : "Highlights"}>
        <Marquee items={MARQUEE} speed={38} />
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section id="stats" className={`section-sm ${styles.statsSection}`}>
        <div className="wrap">
          <Stagger className={styles.statsGrid}>
            {[
              { k: id ? "Maks Frame Rate" : "Max Frame Rate", n: 120, u: "fps" },
              { k: id ? "Data Dikirim" : "Data Sent", n: 0, u: "%" },
              { k: id ? "Per Lisensi" : "Per License", n: 1, u: "PC" },
              { k: "Re-encode", n: null, u: "", t: id ? "Tidak" : "None" },
            ].map((s) => (
              <StaggerItem key={s.k}>
                <Tilt className={`card ${styles.statCard}`} max={10}>
                  <div className={styles.statK}>{s.k}</div>
                  <div className={styles.statV}>
                    {s.n === null ? s.t : <CountUp to={s.n} />}
                    {s.u && <span className={styles.statU}>{s.u}</span>}
                  </div>
                </Tilt>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Storyline (scroll) ────────────────────────────────────────────── */}
      <section className={styles.storySection}>
        <div className="wrap">
          <SectionHead
            eyebrow={id ? "Alur kerja" : "The workflow"}
            title={id ? "Tiga langkah. Nol upload." : "Three steps. Zero uploads."}
          />
          <Storyline />
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <SectionHead
            eyebrow={id ? "Fitur Utama" : "Core Features"}
            title={id ? "Semua yang kamu butuhkan, tanpa yang tidak perlu." : "Everything you need, nothing you don't."}
          />
          <Stagger className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <StaggerItem key={f.title}>
                <Tilt className={`card ${styles.featureCard}`}>
                  <div className={styles.featureTop}>
                    <span className={styles.featureNum}>{f.n}</span>
                    <span className={styles.featureTag}>{f.tag}</span>
                  </div>
                  <div className={`lbl ${styles.featureLbl}`}>{f.label}</div>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  <p className={styles.featureDesc}>{f.desc}</p>
                  <span className={styles.featureBig} aria-hidden="true">{f.n}</span>
                </Tilt>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Demo before/after (diatur admin) ──────────────────────────────── */}
      {demoReady && (
        <section className="section" id="demo">
          <div className="wrap">
            <SectionHead
              eyebrow="Demo"
              title={id ? "Lihat sendiri bedanya." : "See the difference yourself."}
            />
            <Reveal>
              <BeforeAfter site={site} />
            </Reveal>
          </div>
        </section>
      )}

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <SectionHead
            eyebrow={id ? "Cara Mulai" : "Getting Started"}
            title={id ? "Dari daftar sampai upload dalam empat langkah." : "From sign-up to upload in four steps."}
          />
          <div className={styles.steps}>
            <motion.span
              className={styles.stepsLine}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "0px 0px -15% 0px" }}
              transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden="true"
            />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} className={styles.step} delay={0.15 + i * 0.18}>
                <div className={styles.stepNum}><span>{s.n}</span></div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section className="section" id="pricing">
        <div className="wrap">
          <SectionHead
            eyebrow={id ? "Harga" : "Pricing"}
            title={id ? "Bayar sekali. Pakai selamanya." : "Pay once. Use forever."}
          />

          {/* Jujur ke calon pembeli: kalau engine sedang tidak normal, mereka
              harus tahu SEBELUM membayar. */}
          {engineDown && status && (
            <Reveal>
              <Link href="/status" className={`${styles.engineNotice} ${styles[`tone_${STATE_META[status.state].tone}`]}`}>
                <StatusDot status={status} size={8} />
                <span className={styles.engineNoticeLabel}>Engine — {STATE_META[status.state].label[lang]}</span>
                <span className={styles.engineNoticeMsg}>{statusMessage(status, lang)}</span>
              </Link>
            </Reveal>
          )}

          {/* Satu kartu per produk. Kartu Analytics baru muncul setelah kamu
              menyalakannya di panel admin. */}
          <div className={`${styles.pricingGrid} ${PRODUCTS.length === 1 ? styles.pricingGridSingle : ""}`}>
            {PRODUCTS.map((prod, i) => {
              const p = pricing[prod.key];
              const { price, strike } = effectivePrice(p);
              const saving = strike && price ? Math.round((1 - price / strike) * 100) : 0;
              return (
                <Reveal key={prod.key} delay={0.1 + i * 0.1}>
                  <Tilt max={5} className={`${styles.pricingCard} ${i === 0 ? styles.pricingCardFeatured : ""}`}>
                    {i === 0 && <span className={styles.pricingBorder} aria-hidden="true" />}
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
                        {price > 0
                          ? <>Rp <CountUp to={price} duration={1400} format={(n) => n.toLocaleString("id-ID")} /></>
                          : (id ? "Hubungi Admin" : "Contact Admin")}
                      </span>
                      <span className={styles.pricingPer}>/lifetime</span>
                    </div>
                    {saving > 0 && (
                      <div className={styles.pricingSave}>{id ? `Hemat ${saving}%` : `Save ${saving}%`}</div>
                    )}

                    <div className={styles.pricingDivider} />

                    <ul className={styles.pricingList}>
                      {prod.features.map((f, fi) => (
                        <motion.li
                          key={f}
                          className={styles.pricingItem}
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.3 + fi * 0.07, duration: 0.5 }}
                        >
                          <span className={styles.pricingCheck} aria-hidden="true">
                            <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
                          </span>
                          {f}
                        </motion.li>
                      ))}
                    </ul>

                    <a
                      href={wa(prod.waText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-wa"
                      style={{ width: "100%", padding: 16, marginBottom: 12 }}
                      data-cursor={id ? "Beli" : "Buy"}
                    >
                      <WaIcon />
                      {id ? `Beli ${prod.name}` : `Buy ${prod.name}`}
                    </a>
                    <Link href="/register" className="btn btn-ghost" style={{ width: "100%", padding: 14 }}>
                      {id ? "Daftar Dulu" : "Register First"}
                    </Link>
                  </Tilt>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="section" id="faq">
        <div className="wrap">
          <div className={styles.faqLayout}>
            <SectionHead eyebrow="FAQ" title={id ? "Pertanyaan yang sering muncul." : "Frequently asked."}>
              <p className={styles.faqAside}>
                {id ? "Belum terjawab? " : "Still unsure? "}
                <a href={waUrl} target="_blank" rel="noopener noreferrer">{id ? "Tanya admin di WhatsApp" : "Ask the admin on WhatsApp"}</a>
              </p>
            </SectionHead>
            <Stagger className={styles.faqList}>
              {FAQ.map((f, i) => {
                const open = openFaq === i;
                return (
                  <StaggerItem key={f.q} className={`${styles.faqItem} ${open ? styles.faqOpen : ""}`}>
                    <button
                      type="button"
                      className={styles.faqQ}
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? null : i)}
                    >
                      <span className={styles.faqNum}>{String(i + 1).padStart(2, "0")}</span>
                      <span className={styles.faqText}>{f.q}</span>
                      <span className={styles.faqIcon} aria-hidden="true" />
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          key="a"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                          style={{ overflow: "hidden" }}
                        >
                          <p className={styles.faqA}>{f.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </div>
      </section>

      {/* ── Support Creator ────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <Reveal>
            <Tilt max={3} className={`card ${styles.creatorCard}`}>
              <div className={styles.creatorInner}>
                <div className={styles.creatorLeft}>
                  <span className="eyebrow"><Scramble text={id ? "Kreator" : "Creator"} /></span>
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
            </Tilt>
          </Reveal>
        </div>
      </section>

      {/* ── CTA penutup + footer ──────────────────────────────────────────── */}
      <section className={styles.finale}>
        <div className="wrap">
          <Reveal className={styles.finaleInner}>
            <p className={styles.finaleKicker}>{id ? "Siap untuk 120fps?" : "Ready for 120fps?"}</p>
            <Magnetic strength={0.25}>
              <Link href="/register" className={`btn ${styles.ctaPrimary} ${styles.finaleBtn}`} data-cursor={id ? "Daftar" : "Join"}>
                <span className={styles.ctaShine} aria-hidden="true" />
                {id ? "Buat Akun Gratis" : "Create Free Account"}
              </Link>
            </Magnetic>
          </Reveal>
        </div>
        <div className={styles.wordmark} aria-hidden="true">
          <SplitText lines={[{ text: "UNWANTED" }]} inView stagger={0.06} />
        </div>
      </section>

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
      <a href={waUrl} target="_blank" rel="noopener noreferrer" className="wa-float" title="Chat Admin via WhatsApp" data-cursor="Chat">
        <WaIcon size={22} />
      </a>
    </>
  );
}
