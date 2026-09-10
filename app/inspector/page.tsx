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
  duration: number | null; fps: number | null;
  tiktokTier: number | null;  // TikTok processing tier (120 for dual-audio trick)
  hasDualAudio: boolean;      // true = second audio track detected
  bitrateKbps: number | null;
  fileSize: number | null; codecType: string | null; definition: string | null;
  videoId: string | null; embedUrl: string | null; region: string | null;
  createTime: number | null; browserQ: string | null; phoneQ: string | null;
  views: number | null; likes: number | null; comments: number | null;
  favorites: number | null; shares: number | null; downloads: number | null;
  engagementRate: number | null;
  erBreakdown: {
    likesRate: number; commentsRate: number; sharesRate: number;
    favoritesRate: number; downloadsRate: number;
  } | null;
}

// ── SVG Icon Components ────────────────────────────────────────────────────
const s = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const IconRuler    = () => <svg {...s}><path d="M2 12h20M2 6l4 4M2 18l4-4M22 6l-4 4M22 18l-4-4"/></svg>;
const IconPlay     = () => <svg {...s}><polygon points="5,3 19,12 5,21"/></svg>;
const IconBarChart = () => <svg {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconVideo    = () => <svg {...s}><rect x="2" y="6" width="15" height="12" rx="2"/><path d="M17 8l5-2v12l-5-2"/></svg>;
const IconSignal   = () => <svg {...s}><path d="M2 12h2M6 8v8M10 5v14M14 8v8M18 2v20M22 8v8"/></svg>;
const IconEye      = () => <svg {...s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconHeart    = () => <svg {...s}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IconComment  = () => <svg {...s}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconBookmark = () => <svg {...s}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
const IconShare    = () => <svg {...s}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>;
const IconDownload = () => <svg {...s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IconClock    = () => <svg {...s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconCalendar = () => <svg {...s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconSearch   = () => <svg {...s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconCheck    = () => <svg {...s} stroke="#27c93f"><polyline points="20 6 9 17 4 12"/></svg>;
const IconX        = () => <svg {...s} stroke="#ff5f56"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconSend     = () => <svg {...s}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconLink     = () => <svg {...s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtSize(b: number | null): string {
  if (!b) return "—";
  return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : (b / 1024).toFixed(0) + " KB";
}
function fmtDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60); const s2 = sec % 60;
  return `${m}:${s2.toString().padStart(2, "0")}`;
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

// ── Reusable spec row ──────────────────────────────────────────────────────
function SpecRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={styles.specRow}>
      <span className={styles.specLabel}>{label}</span>
      <span className={`${styles.specValue} ${highlight ? styles.specHighlight : ""}`}>{value}</span>
    </div>
  );
}

// ── Engagement item ────────────────────────────────────────────────────────
function EngItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={styles.engItem}>
      <span className={styles.engIcon}>{icon}</span>
      <div className={styles.engLabel}>{label}</div>
      <div className={styles.engValue}>{value}</div>
    </div>
  );
}

// ── Log line types ─────────────────────────────────────────────────────────
type LogEntry = { type: "info" | "success" | "error" | "data"; text: string };

export default function InspectorPage() {
  const { lang } = useLang();
  const id = lang === "id";
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  function pushLog(entry: LogEntry) { setLogs(prev => [...prev, entry]); }

  async function inspect() {
    setError(""); setMeta(null); setLogs([]);
    if (!url.includes("tiktok.com")) {
      setError(id ? "Masukkan URL video TikTok yang valid." : "Enter a valid TikTok video URL.");
      return;
    }
    const vid = extractVideoId(url);
    setLoading(true);

    pushLog({ type: "info",    text: id ? "Mengambil data video..." : "Fetching video data..." });
    await new Promise(r => setTimeout(r, 300));
    if (vid) pushLog({ type: "data",    text: `Data fetched. ID: ${vid}` });
    await new Promise(r => setTimeout(r, 200));
    pushLog({ type: "data",    text: "Source: TikWM + TikTok Mobile API" });
    await new Promise(r => setTimeout(r, 400));
    pushLog({ type: "info",    text: id ? "Mendeteksi kualitas & framerate..." : "Detecting quality & framerate..." });

    try {
      const res = await fetch(`/api/inspector?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Gagal");
      await new Promise(r => setTimeout(r, 300));
      pushLog({ type: "success", text: id ? "Analisis selesai!" : "Analysis complete!" });
      setMeta(data.data);
    } catch (e: unknown) {
      pushLog({ type: "error",   text: "Error: " + ((e as Error).message || "Gagal") });
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

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className={`${styles.header} animate-in`}>
            <div className={styles.headerBadge}>
              <span>{id ? "Gratis" : "Free"}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{id ? "Tanpa Login" : "No Login"}</span>
            </div>
            <h1 className={styles.title}>Video Inspector</h1>
            <p className={styles.sub}>{id ? "Analisis metadata video TikTok" : "Analyze TikTok video metadata"}</p>
          </div>

          {/* ── Feature Row ────────────────────────────────────────────── */}
          <div className={`${styles.featureRow} animate-in`} style={{ animationDelay: "0.05s" }}>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}><IconRuler /></span>
              <div>
                <div className={styles.featureTitle}>{id ? "Spesifikasi Asli" : "True specifications"}</div>
                <div className={styles.featureDesc}>{id ? "Resolusi, framerate, ukuran & durasi persis seperti yang TikTok sajikan." : "Resolution, framerate, size and duration exactly as TikTok serves them."}</div>
              </div>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}><IconPlay /></span>
              <div>
                <div className={styles.featureTitle}>{id ? "Kualitas Streaming" : "Streaming quality"}</div>
                <div className={styles.featureDesc}>{id ? "Kualitas yang diterima browser dan HP dari TikTok." : "Quality served to browsers and phones by TikTok."}</div>
              </div>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}><IconBarChart /></span>
              <div>
                <div className={styles.featureTitle}>Engagement</div>
                <div className={styles.featureDesc}>{id ? "Views, likes, komentar, share, dan engagement rate." : "Views, likes, comments, shares, and the engagement rate."}</div>
              </div>
            </div>
          </div>

          {/* ── Search ─────────────────────────────────────────────────── */}
          <div className={`${styles.searchCard} animate-in`} style={{ animationDelay: "0.1s" }}>
            <div className={styles.searchRow}>
              <span className={styles.searchIcon}><IconSearch /></span>
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

          {/* ── Processing Log ──────────────────────────────────────────── */}
          {logs.length > 0 && (
            <div className={`${styles.logCard} animate-in`}>
              <div className={styles.logHeader}>
                <div className={styles.trafficLights}>
                  <span className={`${styles.dot} ${styles.dotRed}`} />
                  <span className={`${styles.dot} ${styles.dotYellow}`} />
                  <span className={`${styles.dot} ${styles.dotGreen}`} />
                </div>
                <span className={styles.logTitle}>Processing log</span>
              </div>
              <div className={styles.logBody} ref={logRef}>
                {logs.map((entry, i) => (
                  <div key={i} className={`${styles.logLine} ${styles["logLine_" + entry.type]}`}>
                    <span className={styles.logIconWrap}>
                      {entry.type === "success" && <IconCheck />}
                      {entry.type === "error"   && <IconX />}
                      {entry.type === "info"    && <IconSearch />}
                      {entry.type === "data"    && <IconLink />}
                    </span>
                    <span>{entry.text}</span>
                  </div>
                ))}
                {loading && (
                  <div className={styles.logLine}>
                    <span className={styles.logIconWrap} style={{ opacity: 0.2 }}><IconSend /></span>
                    <span className={styles.logCursor}>▌</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Result ─────────────────────────────────────────────────── */}
          {meta && (
            <>
              {/* Video Info Card */}
              <div className={`${styles.videoCard} animate-in`}>
                <div className={styles.videoCardLeft}>
                  {meta.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={meta.thumbnail_url} alt="thumb" className={styles.videoThumb} referrerPolicy="no-referrer" />
                  ) : (
                    <div className={styles.videoThumbPlaceholder}><IconVideo /></div>
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
                      <span className={styles.videoMetaItem}>
                        <IconClock /> {fmtDuration(meta.duration)}
                      </span>
                    )}
                    {meta.createTime && (
                      <span className={styles.videoMetaItem}>
                        <IconCalendar /> {fmtDate(meta.createTime)}
                      </span>
                    )}
                  </div>
                  {meta.embedUrl && (
                    <a
                      href={`https://www.tiktok.com/@${meta.author_id || "_"}/video/${videoId}`}
                      target="_blank" rel="noopener noreferrer"
                      className={styles.watchLink}
                    >
                      <IconLink />
                      {id ? "Tonton di TikTok" : "Watch on TikTok"}
                    </a>
                  )}
                </div>
                <div className={styles.videoCardBadge}>
                  <div className={styles.badgeTitle}>UNWANTED LABS</div>
                  <div className={styles.badgeSub}>
                    <span className={styles.badgeDot} />
                    INSPECTOR
                  </div>
                </div>
              </div>

              {/* Specs + Engagement Grid */}
              <div className={`${styles.bottomGrid} animate-in`}>

                {/* Left: Video Specs */}
                <div className={styles.specsCard}>
                  <div className={styles.cardSectionTitle}>
                    <IconVideo /> {id ? "Spesifikasi Video" : "Video specifications"}
                  </div>
                  <SpecRow label={id ? "Resolusi" : "Resolution"} value={meta.width && meta.height ? `${meta.width}×${meta.height}` : "—"} />
                  {/* Framerate row — shows TikTok tier if dual audio detected */}
                  <div className={styles.specRow}>
                    <span className={styles.specLabel}>Framerate</span>
                    <span className={styles.specValueGroup}>
                      {meta.tiktokTier ? (
                        // TikTok processed via 120fps tier (dual audio trick)
                        <>
                          <span className={styles.specHighlight}>{meta.tiktokTier} FPS</span>
                          <span className={styles.specBadge}>TikTok Tier</span>
                          {meta.fps && meta.fps !== meta.tiktokTier && (
                            <span className={styles.specMuted}>({meta.fps} physical)</span>
                          )}
                        </>
                      ) : (
                        // No dual audio — show physical fps from stts
                        <span className={meta.fps ? styles.specHighlight : ""}>
                          {meta.fps ? `${meta.fps} FPS` : "—"}
                        </span>
                      )}
                    </span>
                  </div>
                  <SpecRow label={id ? "Ukuran File" : "File size"} value={fmtSize(meta.fileSize)} />
                  <SpecRow label={id ? "Durasi" : "Duration"} value={fmtDuration(meta.duration)} />
                  {meta.bitrateKbps && <SpecRow label="Bitrate" value={`${meta.bitrateKbps.toLocaleString()} kbps`} />}
                  {meta.codecType   && <SpecRow label="Codec" value={meta.codecType} />}

                  {(meta.browserQ || meta.phoneQ) && (
                    <>
                      <div className={styles.cardSectionTitle} style={{ marginTop: 20 }}>
                        <IconSignal /> {id ? "Kualitas Streaming" : "Streaming quality"}
                      </div>
                      {meta.browserQ && <SpecRow label="Browser" value={meta.browserQ} />}
                      {meta.phoneQ   && <SpecRow label="Phone"   value={meta.phoneQ} />}
                    </>
                  )}
                </div>

                {/* Right: Engagement */}
                <div className={styles.engCard}>
                  <div className={styles.cardSectionTitle}>
                    <IconBarChart /> Engagement
                  </div>
                  <div className={styles.engGrid}>
                    <EngItem icon={<IconEye />}      label="Views"                          value={fmtNum(meta.views)} />
                    <EngItem icon={<IconHeart />}     label="Likes"                          value={fmtNum(meta.likes)} />
                    <EngItem icon={<IconComment />}   label={id ? "Komentar" : "Comments"}   value={fmtNum(meta.comments)} />
                    <EngItem icon={<IconBookmark />}  label={id ? "Favorit" : "Favorites"}   value={fmtNum(meta.favorites)} />
                    <EngItem icon={<IconShare />}     label="Shares"                         value={fmtNum(meta.shares)} />
                    <EngItem icon={<IconDownload />}  label="Downloads"                      value={fmtNum(meta.downloads)} />
                  </div>
                  {/* Engagement Rate — only shown when erBreakdown is valid */}
                  {meta.erBreakdown && meta.engagementRate !== null && (
                    <div className={styles.engRate}>
                      <div className={styles.engRateRow}>
                        <span className={styles.engRateLabel}>Engagement rate</span>
                        <span className={styles.engRateValue}>{meta.engagementRate}%</span>
                      </div>
                      <div className={styles.engBar}>
                        <div className={styles.engBarFill} style={{ width: `${Math.min(meta.engagementRate * 10, 100)}%` }} />
                      </div>

                      {/* Per-metric breakdown */}
                      <div className={styles.erBreakdown}>
                        {[
                          { label: "Likes",     rate: meta.erBreakdown.likesRate,     icon: <IconHeart /> },
                          { label: "Comments",  rate: meta.erBreakdown.commentsRate,  icon: <IconComment /> },
                          { label: "Shares",    rate: meta.erBreakdown.sharesRate,    icon: <IconShare /> },
                          { label: "Favorites", rate: meta.erBreakdown.favoritesRate, icon: <IconBookmark /> },
                          { label: "Downloads", rate: meta.erBreakdown.downloadsRate, icon: <IconDownload /> },
                        ].map(({ label, rate, icon }) => (
                          <div key={label} className={styles.erRow}>
                            <span className={styles.erRowIcon}>{icon}</span>
                            <span className={styles.erRowLabel}>{label}</span>
                            <div className={styles.erRowBar}>
                              <div
                                className={styles.erRowBarFill}
                                style={{ width: `${Math.min(rate * 20, 100)}%` }}
                              />
                            </div>
                            <span className={styles.erRowRate}>
                              {rate > 0 ? `${rate}%` : "—"}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Formula note */}
                      <div className={styles.erFormula}>
                        ER = (Likes + Comments + Shares + Favorites) ÷ Views × 100
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </>
          )}

          {/* ── Empty State ─────────────────────────────────────────────── */}
          {!meta && !loading && logs.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><IconSearch /></div>
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
