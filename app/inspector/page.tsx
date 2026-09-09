"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import styles from "./inspector.module.css";

interface VideoMeta {
  title: string; author_name: string; author_url: string; thumbnail_url: string;
  thumbnail_width: number; thumbnail_height: number; provider_name: string;
  width: number; height: number;
}

function extractVideoId(url: string): string | null {
  const m = url.match(/video\/(\d+)/);
  return m ? m[1] : null;
}

export default function InspectorPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [error, setError] = useState("");

  async function inspect() {
    setError(""); setMeta(null);
    if (!url.includes("tiktok.com")) { setError("Masukkan URL video TikTok yang valid."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/inspector?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Gagal");
      setMeta(data.data);
    } catch (e: unknown) { setError((e as Error).message || "Gagal mengambil metadata."); }
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
              <span>Gratis</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Tanpa Login</span>
            </div>
            <h1 className={styles.title}>Video Inspector</h1>
            <p className={styles.sub}>Analisis metadata video TikTok</p>
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
              Format: tiktok.com/@user/video/ID atau vm.tiktok.com/ID
            </p>
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
                  <h2 className={styles.videoTitle}>{meta.title || "Tidak ada judul"}</h2>
                  <a href={meta.author_url} target="_blank" rel="noopener noreferrer" className={styles.author}>
                    {meta.author_name}
                  </a>
                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>Thumbnail</div>
                      <div className={styles.metaValue}>{meta.thumbnail_width}×{meta.thumbnail_height}</div>
                    </div>
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>Embed</div>
                      <div className={styles.metaValue}>{meta.width || "—"}×{meta.height || "—"}</div>
                    </div>
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>Platform</div>
                      <div className={styles.metaValue}>{meta.provider_name}</div>
                    </div>
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>Video ID</div>
                      <div className={styles.metaValue}>{videoId || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
              <details className={styles.rawDetails}>
                <summary className={styles.rawSummary}>Raw oEmbed Response</summary>
                <pre className={styles.rawPre}>{JSON.stringify(meta, null, 2)}</pre>
              </details>
              <div className={styles.noteBox}>
                Data dari TikTok oEmbed API (metadata publik). Informasi teknis seperti bitrate dan codec tidak tersedia tanpa extension browser.
              </div>
            </div>
          )}

          {/* Empty */}
          {!meta && !loading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyLabel}>UNWANTED LABS — Inspector</div>
              <h3 className={styles.emptyTitle}>Paste URL Video TikTok</h3>
              <p className={styles.emptyDesc}>
                Informasi tersedia: judul, author, thumbnail, ukuran embed, Video ID
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
