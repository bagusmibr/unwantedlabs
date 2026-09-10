"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import { useLang } from "@/lib/lang";
import styles from "./inspector.module.css";

interface VideoMeta {
  title: string; author_name: string; author_url: string; author_id: string | null;
  thumbnail_url: string; thumbnail_width: number; thumbnail_height: number;
  provider_name: string; width: number | null; height: number | null;
  duration: number | null; fps: number | null; bitrateKbps: number | null;
  fileSize: number | null;
}

function extractVideoId(url: string): string | null {
  const m = url.match(/video\/(\d+)/);
  return m ? m[1] : null;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1024).toFixed(0) + " KB";
}

function fmtDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function InspectorPage() {
  const { lang } = useLang();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [error, setError] = useState("");

  const t = {
    badge1:     lang === "id" ? "Gratis"          : "Free",
    badge2:     lang === "id" ? "Tanpa Login"     : "No Login",
    title:      "Video Inspector",
    sub:        lang === "id" ? "Analisis metadata video TikTok" : "Analyze TikTok video metadata",
    placeholder:"https://www.tiktok.com/@user/video/123",
    hint:       lang === "id" ? "Format: tiktok.com/@user/video/ID atau vm.tiktok.com/ID" : "Format: tiktok.com/@user/video/ID or vm.tiktok.com/ID",
    inspect:    "Inspect",
    loading:    lang === "id" ? "Memuat..." : "Loading...",
    errInvalid: lang === "id" ? "Masukkan URL video TikTok yang valid." : "Enter a valid TikTok video URL.",
    errFail:    lang === "id" ? "Gagal mengambil metadata." : "Failed to fetch metadata.",
    emptyLabel: "UNWANTED LABS — Inspector",
    emptyTitle: lang === "id" ? "Paste URL Video TikTok" : "Paste a TikTok Video URL",
    emptyDesc:  lang === "id" ? "Informasi tersedia: judul, resolusi, FPS, bitrate, durasi, Video ID" : "Available info: title, resolution, FPS, bitrate, duration, Video ID",
    lThumbnail: "Thumbnail",
    lResolution:lang === "id" ? "Resolusi" : "Resolution",
    lFPS:       "FPS",
    lBitrate:   "Bitrate",
    lDuration:  lang === "id" ? "Durasi"   : "Duration",
    lPlatform:  "Platform",
    lVideoID:   "Video ID",
    lSize:      lang === "id" ? "Ukuran File" : "File Size",
    rawBtn:     "Raw JSON",
    noteBox:    lang === "id"
      ? "Data dari TikTok oEmbed + tikwm API. FPS dihitung dari header MP4 video. Bitrate estimasi dari ukuran file ÷ durasi."
      : "Data from TikTok oEmbed + tikwm API. FPS parsed from MP4 header. Bitrate estimated from file size ÷ duration.",
  };

  async function inspect() {
    setError(""); setMeta(null);
    if (!url.includes("tiktok.com") && !url.includes("vm.tiktok.com")) {
      setError(t.errInvalid); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/inspector?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Gagal");
      setMeta(data.data);
    } catch (e: unknown) { setError((e as Error).message || t.errFail); }
    setLoading(false);
  }

  const videoId = meta ? extractVideoId(url) : null;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className="wrap-md">
          <div className={`${styles.header} animate-in`}>
            <div className={styles.headerBadge}>
              <span>{t.badge1}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{t.badge2}</span>
            </div>
            <h1 className={styles.title}>{t.title}</h1>
            <p className={styles.sub}>{t.sub}</p>
          </div>

          {/* Search */}
          <div className={`${styles.searchCard} animate-in`} style={{ animationDelay: "0.1s" }}>
            <div className={styles.searchRow}>
              <input
                className={`input ${styles.searchInput}`}
                type="url"
                placeholder={t.placeholder}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && inspect()}
              />
              <button className={`btn ${styles.searchBtn}`} onClick={inspect} disabled={loading || !url}>
                {loading ? <div className="spinner" style={{ width: 12, height: 12 }} /> : t.inspect}
              </button>
            </div>
            {error && <div className={styles.errorMsg}>{error}</div>}
            <p className={styles.searchHint}>{t.hint}</p>
          </div>

          {/* Result */}
          {meta && (
            <div className={styles.resultCard}>
              <div className={styles.resultTop}>
                {meta.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={meta.thumbnail_url} alt="Thumbnail" className={styles.thumbnail} referrerPolicy="no-referrer" />
                )}
                <div className={styles.resultInfo}>
                  <h2 className={styles.videoTitle}>{meta.title || "—"}</h2>
                  <a href={meta.author_url} target="_blank" rel="noopener noreferrer" className={styles.author}>
                    {meta.author_name}{meta.author_id ? ` (@${meta.author_id})` : ""}
                  </a>
                  <div className={styles.metaGrid}>
                    {/* Resolution */}
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>{t.lResolution}</div>
                      <div className={styles.metaValue}>
                        {meta.width && meta.height ? `${meta.width}×${meta.height}` : "—"}
                      </div>
                    </div>
                    {/* FPS */}
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>{t.lFPS}</div>
                      <div className={`${styles.metaValue} ${meta.fps ? styles.metaHighlight : ""}`}>
                        {meta.fps ? `${meta.fps} fps` : "—"}
                      </div>
                    </div>
                    {/* Bitrate */}
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>{t.lBitrate}</div>
                      <div className={`${styles.metaValue} ${meta.bitrateKbps ? styles.metaHighlight : ""}`}>
                        {meta.bitrateKbps ? `${meta.bitrateKbps.toLocaleString()} kbps` : "—"}
                      </div>
                    </div>
                    {/* Duration */}
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>{t.lDuration}</div>
                      <div className={styles.metaValue}>{fmtDuration(meta.duration)}</div>
                    </div>
                    {/* File Size */}
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>{t.lSize}</div>
                      <div className={styles.metaValue}>{fmtSize(meta.fileSize)}</div>
                    </div>
                    {/* Thumbnail size */}
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>{t.lThumbnail}</div>
                      <div className={styles.metaValue}>{meta.thumbnail_width}×{meta.thumbnail_height}</div>
                    </div>
                    {/* Platform */}
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>{t.lPlatform}</div>
                      <div className={styles.metaValue}>{meta.provider_name}</div>
                    </div>
                    {/* Video ID */}
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>{t.lVideoID}</div>
                      <div className={styles.metaValue} style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}>
                        {videoId || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <details className={styles.rawDetails}>
                <summary className={styles.rawSummary}>{t.rawBtn}</summary>
                <pre className={styles.rawPre}>{JSON.stringify(meta, null, 2)}</pre>
              </details>
              <div className={styles.noteBox}>{t.noteBox}</div>
            </div>
          )}

          {/* Empty state */}
          {!meta && !loading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyLabel}>{t.emptyLabel}</div>
              <h3 className={styles.emptyTitle}>{t.emptyTitle}</h3>
              <p className={styles.emptyDesc}>{t.emptyDesc}</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
