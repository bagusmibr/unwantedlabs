"use client";
import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import { useLang } from "@/lib/lang";
import styles from "./inspector.module.css";

// ── Types ──────────────────────────────────────────────────────────────────
interface VideoMeta {
  title: string; author_name: string; author_url: string; author_id: string | null;
  author_avatar: string | null; thumbnail_url: string;
  thumbnail_width: number; thumbnail_height: number;
  provider_name: string; width: number | null; height: number | null;
  duration: number | null; fps: number | null; bitrateKbps: number | null;
  fileSize: number | null; codecType: string | null; definition: string | null;
  videoId: string | null; embedUrl: string | null; region: string | null;
  createTime: number | null; browserQ: string | null; phoneQ: string | null;
  views: number | null; likes: number | null; comments: number | null;
  favorites: number | null; shares: number | null; downloads: number | null;
  engagementRate: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtSize(b: number | null): string {
  if (!b) return "—";
  return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : (b / 1024).toFixed(0) + " KB";
}
function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
function fmtNum(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}
function regionToFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}
function extractVideoId(url: string): string | null {
  return url.match(/video\/(\d+)/)?.[1] ?? null;
}
function fmtDate(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function InspectorPage() {
  const { lang } = useLang();
  const id = lang === "id";
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  function pushLog(line: string) {
    setLogs(prev => [...prev, line]);
  }

  async function inspect() {
    setError(""); setMeta(null); setLogs([]);
    if (!url.includes("tiktok.com")) {
      setError(id ? "Masukkan URL video TikTok yang valid." : "Enter a valid TikTok video URL.");
      return;
    }
    const vid = extractVideoId(url);
    setLoading(true);

    // Animated log steps
    pushLog("🔍 " + (id ? "Mengambil data video..." : "Fetching video data..."));
    await new Promise(r => setTimeout(r, 300));
    if (vid) pushLog(`✓ Video ID terdeteksi: ${vid}`);
    await new Promise(r => setTimeout(r, 200));
    pushLog("📡 Source: TikWM + TikTok Mobile API");
    await new Promise(r => setTimeout(r, 400));
    pushLog("📊 " + (id ? "Mendeteksi kualitas & framerate..." : "Detecting quality & framerate..."));

    try {
      const res = await fetch(`/api/inspector?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Gagal");
      await new Promise(r => setTimeout(r, 300));
      pushLog("✓ " + (id ? "Analisis selesai!" : "Analysis complete!"));
      setMeta(data.data);
    } catch (e: unknown) {
      pushLog("✗ Error: " + ((e as Error).message || "Gagal"));
      setError((e as Error).message || (id ? "Gagal mengambil metadata." : "Failed to fetch metadata."));
    }
    setLoading(false);
  }

  const videoId = meta ? extractVideoId(url) : null;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className="wrap-md">
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

          {/* What you get */}
          <div className={`${styles.featureRow} animate-in`} style={{ animationDelay: "0.05s" }}>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📐</span>
              <div>
                <div className={styles.featureTitle}>{id ? "Spesifikasi Asli" : "True specifications"}</div>
                <div className={styles.featureDesc}>{id ? "Resolusi, framerate, ukuran & durasi persis seperti yang TikTok sajikan." : "Resolution, framerate, size and duration exactly as TikTok serves them."}</div>
              </div>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>⚡</span>
              <div>
                <div className={styles.featureTitle}>{id ? "Kualitas Streaming" : "Streaming quality"}</div>
                <div className={styles.featureDesc}>{id ? "Kualitas yang diterima browser dan HP dari TikTok." : "Quality served to browsers and phones by TikTok."}</div>
              </div>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📊</span>
              <div>
                <div className={styles.featureTitle}>Engagement</div>
                <div className={styles.featureDesc}>{id ? "Views, likes, komentar, share, dan engagement rate." : "Views, likes, comments, shares, and the engagement rate."}</div>
              </div>
            </div>
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
              {id ? "Format: tiktok.com/@user/video/ID" : "Format: tiktok.com/@user/video/ID"}
            </p>
          </div>

          {/* Processing Log */}
          {logs.length > 0 && (
            <div className={`${styles.logCard} animate-in`}>
              {/* macOS traffic lights */}
              <div className={styles.logHeader}>
                <div className={styles.trafficLights}>
                  <span className={`${styles.dot} ${styles.dotRed}`} />
                  <span className={`${styles.dot} ${styles.dotYellow}`} />
                  <span className={`${styles.dot} ${styles.dotGreen}`} />
                </div>
                <span className={styles.logTitle}>Processing log</span>
              </div>
              <div className={styles.logBody} ref={logRef}>
                {logs.map((line, i) => (
                  <div key={i} className={styles.logLine}>
                    <span className={styles.logPrompt}>&gt;</span> {line}
                  </div>
                ))}
                {loading && (
                  <div className={styles.logLine}>
                    <span className={styles.logPrompt}>&gt;</span>
                    <span className={styles.logCursor}>▌</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {meta && (
            <>
              {/* Video Info Card */}
              <div className={`${styles.videoCard} animate-in`}>
                <div className={styles.videoCardLeft}>
                  {meta.author_avatar || meta.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={meta.thumbnail_url}
                      alt="thumb"
                      className={styles.videoThumb}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={styles.videoThumbPlaceholder}>▶</div>
                  )}
                </div>
                <div className={styles.videoCardInfo}>
                  <div className={styles.videoAuthorRow}>
                    <span className={styles.videoAuthor}>@{meta.author_id || meta.author_name}</span>
                    {meta.region && (
                      <span className={styles.videoFlag} title={meta.region}>
                        {regionToFlag(meta.region)} {meta.region}
                      </span>
                    )}
                  </div>
                  <p className={styles.videoDesc}>{meta.title}</p>
                  <div className={styles.videoMeta}>
                    {meta.duration && (
                      <span>🕐 {fmtDuration(meta.duration)}</span>
                    )}
                    {meta.createTime && (
                      <span>📅 {fmtDate(meta.createTime)}</span>
                    )}
                  </div>
                  {meta.embedUrl && (
                    <a href={`https://www.tiktok.com/@${meta.author_id || "_"}/video/${videoId}`}
                       target="_blank" rel="noopener noreferrer" className={styles.watchLink}>
                      {id ? "Tonton di TikTok ↗" : "Watch on TikTok ↗"}
                    </a>
                  )}
                </div>
                <div className={styles.videoCardBadge}>
                  <div className={styles.badgeTitle}>UNWANTED LABS</div>
                  <div className={styles.badgeSub}>
                    <span className={styles.badgeDot} />
                    {id ? "INSPECTOR" : "INSPECTOR"}
                  </div>
                </div>
              </div>

              {/* Specs + Engagement */}
              <div className={`${styles.bottomGrid} animate-in`}>
                {/* Left: Video Specs */}
                <div className={styles.specsCard}>
                  <div className={styles.cardSectionTitle}>
                    <span>📹</span> {id ? "Spesifikasi Video" : "Video specifications"}
                  </div>
                  <div className={styles.specRow}>
                    <span className={styles.specLabel}>{id ? "Resolusi" : "Resolution"}</span>
                    <span className={styles.specValue}>
                      {meta.width && meta.height ? `${meta.width}x${meta.height}` : "—"}
                    </span>
                  </div>
                  <div className={styles.specRow}>
                    <span className={styles.specLabel}>Framerate</span>
                    <span className={`${styles.specValue} ${meta.fps ? styles.specHighlight : ""}`}>
                      {meta.fps ? `${meta.fps} FPS` : "—"}
                    </span>
                  </div>
                  <div className={styles.specRow}>
                    <span className={styles.specLabel}>{id ? "Ukuran File" : "File size"}</span>
                    <span className={styles.specValue}>{fmtSize(meta.fileSize)}</span>
                  </div>
                  <div className={styles.specRow}>
                    <span className={styles.specLabel}>{id ? "Durasi" : "Duration"}</span>
                    <span className={styles.specValue}>{fmtDuration(meta.duration)}</span>
                  </div>
                  {meta.bitrateKbps && (
                    <div className={styles.specRow}>
                      <span className={styles.specLabel}>Bitrate</span>
                      <span className={styles.specValue}>{meta.bitrateKbps.toLocaleString()} kbps</span>
                    </div>
                  )}
                  {meta.codecType && (
                    <div className={styles.specRow}>
                      <span className={styles.specLabel}>Codec</span>
                      <span className={styles.specValue}>{meta.codecType}</span>
                    </div>
                  )}

                  {(meta.browserQ || meta.phoneQ) && (
                    <>
                      <div className={styles.cardSectionTitle} style={{ marginTop: 20 }}>
                        <span>📡</span> {id ? "Kualitas Streaming" : "Streaming quality"}
                      </div>
                      {meta.browserQ && (
                        <div className={styles.specRow}>
                          <span className={styles.specLabel}>Browser</span>
                          <span className={styles.specValue}>{meta.browserQ}</span>
                        </div>
                      )}
                      {meta.phoneQ && (
                        <div className={styles.specRow}>
                          <span className={styles.specLabel}>Phone</span>
                          <span className={styles.specValue}>{meta.phoneQ}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Right: Engagement */}
                <div className={styles.engCard}>
                  <div className={styles.cardSectionTitle}>
                    <span>📈</span> Engagement
                  </div>
                  <div className={styles.engGrid}>
                    <div className={styles.engItem}>
                      <span className={styles.engIcon}>👁️</span>
                      <div className={styles.engLabel}>Views</div>
                      <div className={styles.engValue}>{fmtNum(meta.views)}</div>
                    </div>
                    <div className={styles.engItem}>
                      <span className={styles.engIcon}>❤️</span>
                      <div className={styles.engLabel}>Likes</div>
                      <div className={styles.engValue}>{fmtNum(meta.likes)}</div>
                    </div>
                    <div className={styles.engItem}>
                      <span className={styles.engIcon}>💬</span>
                      <div className={styles.engLabel}>{id ? "Komentar" : "Comments"}</div>
                      <div className={styles.engValue}>{fmtNum(meta.comments)}</div>
                    </div>
                    <div className={styles.engItem}>
                      <span className={styles.engIcon}>🔖</span>
                      <div className={styles.engLabel}>{id ? "Favorit" : "Favorites"}</div>
                      <div className={styles.engValue}>{fmtNum(meta.favorites)}</div>
                    </div>
                    <div className={styles.engItem}>
                      <span className={styles.engIcon}>↗️</span>
                      <div className={styles.engLabel}>Shares</div>
                      <div className={styles.engValue}>{fmtNum(meta.shares)}</div>
                    </div>
                    <div className={styles.engItem}>
                      <span className={styles.engIcon}>⬇️</span>
                      <div className={styles.engLabel}>Downloads</div>
                      <div className={styles.engValue}>{fmtNum(meta.downloads)}</div>
                    </div>
                  </div>
                  {meta.engagementRate !== null && (
                    <div className={styles.engRate}>
                      <div className={styles.engRateRow}>
                        <span className={styles.engRateLabel}>Engagement rate</span>
                        <span className={styles.engRateValue}>{meta.engagementRate}%</span>
                      </div>
                      <div className={styles.engBar}>
                        <div className={styles.engBarFill} style={{ width: `${Math.min(meta.engagementRate * 10, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Empty state */}
          {!meta && !loading && logs.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyLabel}>UNWANTED LABS — Inspector</div>
              <h3 className={styles.emptyTitle}>{id ? "Paste URL Video TikTok" : "Paste a TikTok Video URL"}</h3>
              <p className={styles.emptyDesc}>
                {id ? "FPS, bitrate, resolusi, engagement, dan kualitas streaming" : "FPS, bitrate, resolution, engagement, and streaming quality"}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
