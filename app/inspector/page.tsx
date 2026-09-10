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
  fileSize: number | null; videoId: string | null; embedUrl: string | null;
  codecType: string | null; definition: string | null;
}

function extractVideoId(url: string): string | null {
  const m = url.match(/video\/(\d+)/);
  return m ? m[1] : null;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : (bytes / 1024).toFixed(0) + " KB";
}

function fmtDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function MetaCell({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={styles.metaItem}>
      <div className={styles.metaLabel}>{label}</div>
      <div className={`${styles.metaValue} ${highlight ? styles.metaHighlight : ""}`}>{value}</div>
    </div>
  );
}

export default function InspectorPage() {
  const { lang } = useLang();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [error, setError] = useState("");

  const id = lang === "id";

  async function inspect() {
    setError(""); setMeta(null);
    if (!url.includes("tiktok.com")) { setError(id ? "Masukkan URL video TikTok yang valid." : "Enter a valid TikTok video URL."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/inspector?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Gagal");
      setMeta(data.data);
    } catch (e: unknown) { setError((e as Error).message || (id ? "Gagal mengambil metadata." : "Failed to fetch metadata.")); }
    setLoading(false);
  }

  const videoId = meta ? extractVideoId(url) : null;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className="wrap">
          {/* Header */}
          <div className={`${styles.header} animate-in`}>
            <div className={styles.headerBadge}>
              <span>{id ? "Gratis" : "Free"}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{id ? "Tanpa Login" : "No Login"}</span>
            </div>
            <h1 className={styles.title}>Video Inspector</h1>
            <p className={styles.sub}>{id ? "Analisis metadata video TikTok" : "Analyze TikTok video metadata"}</p>
          </div>

          {/* Search */}
          <div className={`${styles.searchCard} animate-in`} style={{ animationDelay: "0.1s" }}>
            <div className={styles.searchRow}>
              <input
                className={`input ${styles.searchInput}`}
                type="url"
                placeholder="https://www.tiktok.com/@user/video/123"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && inspect()}
              />
              <button className={`btn ${styles.searchBtn}`} onClick={inspect} disabled={loading || !url}>
                {loading ? <div className="spinner" style={{ width: 12, height: 12 }} /> : "Inspect"}
              </button>
            </div>
            {error && <div className={styles.errorMsg}>{error}</div>}
            <p className={styles.searchHint}>
              {id ? "Format: tiktok.com/@user/video/ID atau vm.tiktok.com/ID" : "Format: tiktok.com/@user/video/ID or vm.tiktok.com/ID"}
            </p>
          </div>

          {/* Result */}
          {meta && (
            <div className={`${styles.resultCard} animate-in`} style={{ animationDelay: "0.15s" }}>
              {/* Top: Thumbnail + title */}
              <div className={styles.resultHeader}>
                {meta.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.thumbnail_url}
                    alt="Thumbnail"
                    className={styles.thumbnail}
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className={styles.resultMeta}>
                  <div className={styles.resultPlatform}>{meta.provider_name}</div>
                  <h2 className={styles.videoTitle}>{meta.title || "—"}</h2>
                  <a href={meta.author_url} target="_blank" rel="noopener noreferrer" className={styles.author}>
                    {meta.author_name}{meta.author_id ? ` · @${meta.author_id}` : ""}
                  </a>
                  <div className={styles.resultActions}>
                    {meta.embedUrl && (
                      <a
                        href={`https://www.tiktok.com/@${meta.author_id || "_"}/video/${videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`btn ${styles.watchBtn}`}
                      >
                        {id ? "Tonton di TikTok" : "Watch on TikTok"} ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className={styles.divider} />

              {/* Metadata grid */}
              <div className={styles.metaGrid}>
                <MetaCell
                  label={id ? "Resolusi" : "Resolution"}
                  value={meta.width && meta.height && typeof meta.width === "number" && typeof meta.height === "number"
                    ? `${meta.width}×${meta.height}`
                    : meta.thumbnail_width && meta.thumbnail_height
                    ? `${meta.thumbnail_width}×${meta.thumbnail_height} (thumbnail)`
                    : "—"}
                />
                <MetaCell
                  label="FPS"
                  highlight={!!meta.fps}
                  value={meta.fps ? `${meta.fps} fps` : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>N/A</span>}
                />
                <MetaCell
                  label="Bitrate"
                  highlight={!!meta.bitrateKbps}
                  value={meta.bitrateKbps ? `${meta.bitrateKbps.toLocaleString()} kbps` : "—"}
                />
                <MetaCell
                  label={id ? "Durasi" : "Duration"}
                  value={fmtDuration(meta.duration)}
                />
                <MetaCell
                  label={id ? "Ukuran File" : "File Size"}
                  value={fmtSize(meta.fileSize)}
                />
                <MetaCell
                  label="Thumbnail"
                  value={meta.thumbnail_width && meta.thumbnail_height ? `${meta.thumbnail_width}×${meta.thumbnail_height}` : "—"}
                />
                {meta.codecType && <MetaCell label="Codec" value={meta.codecType} />}
                {meta.definition && <MetaCell label={id ? "Kualitas" : "Quality"} value={meta.definition} />}
                <MetaCell label="Platform" value={meta.provider_name} />
                <MetaCell
                  label="Video ID"
                  value={<span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}>{videoId || "—"}</span>}
                />
              </div>

              {/* Raw JSON */}
              <details className={styles.rawDetails}>
                <summary className={styles.rawSummary}>Raw JSON</summary>
                <pre className={styles.rawPre}>{JSON.stringify(meta, null, 2)}</pre>
              </details>

              {/* Note */}
              <div className={styles.noteBox}>
                {id
                  ? "Data dari TikTok oEmbed + tikwm API. FPS & bitrate dari metadata publik TikTok."
                  : "Data from TikTok oEmbed + tikwm API. FPS & bitrate from public TikTok metadata."}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!meta && !loading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyLabel}>UNWANTED LABS — Inspector</div>
              <h3 className={styles.emptyTitle}>{id ? "Paste URL Video TikTok" : "Paste a TikTok Video URL"}</h3>
              <p className={styles.emptyDesc}>
                {id ? "Informasi tersedia: judul, resolusi, FPS, bitrate, durasi, Video ID" : "Available info: title, resolution, FPS, bitrate, duration, Video ID"}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
