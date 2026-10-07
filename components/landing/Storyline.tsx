"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLang } from "@/lib/lang";
import { useFxLevel } from "@/components/fx/useFxLevel";
import { Reveal } from "@/components/fx/Reveal";
import styles from "./Storyline.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Perjalanan pelanggan sebagai adegan yang digerakkan scroll:
 *   01  DROP    — file jatuh ke jendela browser, penghitung upload tetap 0 KB
 *   02  ENGINE  — "kotak hitam" bercahaya bekerja; isinya sengaja TIDAK
 *                 ditampilkan (cara kerja engine adalah rahasia dagang)
 *   03  UPLOAD  — HP dengan badge 120 FPS, meter naik ke 120
 *
 * JANGAN menambahkan detail teknis apa pun tentang cara kerja engine di sini
 * (nama box MP4, track, timescale, dsb.) — halaman ini publik.
 *
 * Level "full": section menempel (pin) dan animasi mengikuti scroll.
 * Level "lite"/"off": tiga panel statis — pin di HP terasa patah.
 */
export default function Storyline() {
  const { lang } = useLang();
  const id = lang === "id";
  const level = useFxLevel();
  const root = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);

  const STEPS = [
    {
      k: "01",
      t: id ? "Drop videonya" : "Drop your video",
      d: id
        ? "Seret MP4 ke studio. File dibaca langsung di browser-mu — tidak ada satu byte pun yang diupload."
        : "Drag an MP4 into the studio. It's read right in your browser — not a single byte is uploaded.",
    },
    {
      k: "02",
      t: id ? "Engine bekerja" : "The engine works",
      d: id
        ? "Engine UNWANTED memproses file sepenuhnya di perangkatmu dalam hitungan detik. Tanpa re-encode — setiap frame tetap utuh."
        : "The UNWANTED engine processes the file entirely on your device in seconds. No re-encode — every frame stays intact.",
    },
    {
      k: "03",
      t: id ? "Upload ke TikTok" : "Upload to TikTok",
      d: id
        ? "Unduh hasilnya dan upload ke TikTok Studio seperti biasa — frame rate aslinya ikut terbawa."
        : "Download the result and upload to TikTok Studio as usual — the original frame rate comes along.",
    },
  ];

  useEffect(() => {
    if (level !== "full") return;
    const el = root.current;
    if (!el) return;

    // Keadaan awal SEMUA elemen ditentukan CSS; timeline ter-scrub hanya
    // memakai .to() supaya progres 0 selalu sama persis dengan CSS.
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      const prog = { v: 0 };
      const fps = { v: 30 };

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "+=280%",
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      });

      // 01 — file jatuh ke dropzone
      tl.to(q("[data-file]"), { y: 0, autoAlpha: 1, rotate: 0, duration: 0.6, ease: "power3.out" })
        .to(q("[data-drop]"), { borderColor: "rgba(255,255,255,0.7)", duration: 0.2 }, "-=0.2")
        .to(q("[data-uploaded]"), { autoAlpha: 1, duration: 0.2 })
        .to({}, { duration: 0.35 });

      // 02 — kotak hitam
      tl.to(q("[data-step='0']"), { autoAlpha: 0, y: -30, duration: 0.3 })
        .to(q("[data-step='1']"), { autoAlpha: 1, y: 0, duration: 0.3 }, "<0.15")
        .to(q("[data-scene='0']"), { autoAlpha: 0, scale: 0.94, duration: 0.4 }, "<")
        .to(q("[data-scene='1']"), { autoAlpha: 1, scale: 1, duration: 0.5 }, "<0.15")
        .to(q("[data-ring]"), { strokeDashoffset: 0, duration: 1.2, ease: "none" })
        .to(prog, {
          v: 100,
          duration: 1.2,
          ease: "none",
          onUpdate: () => { if (pctRef.current) pctRef.current.textContent = String(Math.round(prog.v)).padStart(3, "0"); },
        }, "<")
        .to(q("[data-core]"), { boxShadow: "0 0 90px 10px rgba(255,255,255,0.35)", duration: 1.2, ease: "none" }, "<")
        .to(q("[data-sealed]"), { autoAlpha: 1, duration: 0.25 })
        .to({}, { duration: 0.3 });

      // 03 — HP + 120 FPS
      tl.to(q("[data-step='1']"), { autoAlpha: 0, y: -30, duration: 0.3 })
        .to(q("[data-step='2']"), { autoAlpha: 1, y: 0, duration: 0.3 }, "<0.15")
        .to(q("[data-scene='1']"), { autoAlpha: 0, scale: 1.06, duration: 0.4 }, "<")
        .to(q("[data-scene='2']"), { autoAlpha: 1, y: 0, duration: 0.5 }, "<0.15")
        .to(q("[data-badge]"), { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(2.2)" })
        .to(q("[data-meterfill]"), { scaleX: 1, duration: 1, ease: "power3.out" }, "<")
        .to(fps, {
          v: 120,
          duration: 1,
          ease: "power3.out",
          onUpdate: () => { if (fpsRef.current) fpsRef.current.textContent = String(Math.round(fps.v)); },
        }, "<")
        .to({}, { duration: 0.4 });

      tl.eventCallback("onUpdate", () => {
        const p = tl.progress();
        const active = p < 0.27 ? 0 : p < 0.66 ? 1 : 2;
        q("[data-dot]").forEach((d, i) => ((d as HTMLElement).dataset.on = i <= active ? "1" : ""));
      });
    }, el);

    return () => ctx.revert();
  }, [level]);

  if (level !== "full") {
    const ICONS = [
      <svg key="a" viewBox="0 0 32 32" width="28" height="28"><rect x="7" y="4" width="18" height="24" fill="none" stroke="currentColor" /><path d="M16 21V11m-4 4l4-4 4 4" fill="none" stroke="currentColor" /></svg>,
      <svg key="b" viewBox="0 0 32 32" width="28" height="28"><rect x="8" y="8" width="16" height="16" fill="currentColor" /><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeDasharray="3 3" /></svg>,
      <svg key="c" viewBox="0 0 32 32" width="28" height="28"><rect x="10" y="3" width="12" height="26" rx="2" fill="none" stroke="currentColor" /><path d="M13 16l2 2 4-4" fill="none" stroke="currentColor" /></svg>,
    ];
    return (
      <div className={styles.static}>
        {STEPS.map((s, i) => (
          <Reveal key={s.k} delay={i * 0.05} className={`card ${styles.staticCard}`}>
            <div className={styles.staticTop}>
              <span className={styles.stepK}>{s.k}</span>
              <span className={styles.staticIcon}>{ICONS[i]}</span>
            </div>
            <h3 className={styles.stepT}>{s.t}</h3>
            <p className={styles.stepD}>{s.d}</p>
          </Reveal>
        ))}
      </div>
    );
  }

  return (
    <div ref={root} className={styles.pin}>
      <div className={styles.grid}>
        <div className={styles.copy}>
          <div className={styles.dots}>
            {STEPS.map((s, i) => <span key={s.k} data-dot className={styles.dot} data-on={i === 0 ? "1" : ""} />)}
          </div>
          <div className={styles.stepStack}>
            {STEPS.map((s, i) => (
              <div key={s.k} data-step={i} className={styles.step}>
                <span className={styles.stepK}>{s.k} / 03</span>
                <h3 className={styles.stepT}>{s.t}</h3>
                <p className={styles.stepD}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.stage}>
          {/* ── Adegan 1: jendela browser + dropzone ── */}
          <div data-scene="0" className={`${styles.scene} ${styles.scene0}`}>
            <div className={styles.browser}>
              <div className={styles.browserBar}>
                <i /><i /><i />
                <span className={styles.url}>unwanted labs / studio</span>
                <svg className={styles.lock} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><rect x="2" y="5.5" width="8" height="5.5" fill="currentColor" /><path d="M4 5.5V4a2 2 0 014 0v1.5" fill="none" stroke="currentColor" /></svg>
              </div>
              <div className={styles.browserBody}>
                <div data-drop className={styles.drop}>
                  <div data-file className={styles.file}>
                    <span className={styles.fileIcon} aria-hidden="true" />
                    <span className={styles.fileName}>video.mp4</span>
                    <span className={styles.fileMeta}>124.8 MB</span>
                  </div>
                </div>
                <div className={styles.net}>
                  <span>{id ? "Diupload ke server" : "Uploaded to server"}</span>
                  <strong>↑ 0 KB</strong>
                  <span data-uploaded className={styles.netOk}>{id ? "100% lokal" : "100% local"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Adegan 2: kotak hitam — isi engine sengaja tidak ditampilkan ── */}
          <div data-scene="1" className={`${styles.scene} ${styles.scene1}`}>
            <div className={styles.core}>
              <span className={`${styles.orbit} ${styles.orbitA}`} aria-hidden="true" />
              <span className={`${styles.orbit} ${styles.orbitB}`} aria-hidden="true" />
              <svg className={styles.ringSvg} viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="92" className={styles.ringTrack} />
                <circle cx="100" cy="100" r="92" data-ring className={styles.ring} pathLength={100} />
              </svg>
              <div data-core className={styles.box}>
                <span className={styles.boxLbl}>UNWANTED</span>
                <span className={styles.boxName}>ENGINE</span>
                <span className={styles.boxPct}><span ref={pctRef}>000</span>%</span>
              </div>
            </div>
            <div className={styles.coreCaption}>
              <span>{id ? "Diproses lokal" : "Processed locally"}</span>
              <span className={styles.capDot} />
              <span>{id ? "Frame tidak disentuh" : "Frames untouched"}</span>
              <span data-sealed className={styles.sealed}>{id ? "Selesai ✓" : "Done ✓"}</span>
            </div>
          </div>

          {/* ── Adegan 3: HP + 120 FPS ── */}
          <div data-scene="2" className={`${styles.scene} ${styles.scene2}`}>
            <div className={styles.phone}>
              <div className={styles.screen}>
                <div className={styles.motion} aria-hidden="true" />
                <span data-badge className={styles.badge}>120 FPS</span>
                <div className={styles.uiRail} aria-hidden="true"><i /><i /><i /></div>
                <div className={styles.uiCaption} aria-hidden="true"><i /><i /></div>
              </div>
            </div>
            <div className={styles.meter}>
              <div className={styles.meterTop}>
                <span>Frame rate</span>
                <span className={styles.meterVal}><span ref={fpsRef}>30</span><small>fps</small></span>
              </div>
              <div className={styles.meterBar}><span data-meterfill className={styles.meterFill} /></div>
              <div className={styles.meterScale}><span>30</span><span>60</span><span>90</span><span>120</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
