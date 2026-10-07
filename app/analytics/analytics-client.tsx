"use client";
import SplitText from "@/components/fx/SplitText";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { useLang } from "@/lib/lang";
import { registerDevice, type PCStatus } from "@/lib/fingerprint";
import type { QuotaState } from "@/lib/quota";
import { engagementRate, summarize, monthlyTrend, hourPattern, dayPattern } from "@/lib/analytics-stats";
import type { AnalyticsAuthor, AnalyticsVideo } from "@/lib/tiktok-source";
import { BarsChart, TrendChart } from "./charts";
import type { CellObject, Row, SheetData } from "write-excel-file/browser";
import styles from "./analytics.module.css";

type SortKey = "date" | "views" | "likes" | "comments" | "shares" | "er";

function fmtNum(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("id-ID");
}
function fmtFull(n: number): string {
  return n.toLocaleString("id-ID");
}
function fmtDate(ts: number | null, id: boolean): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString(id ? "id-ID" : "en-GB", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}
function fmtDur(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AnalyticsClient({
  userName,
  initialQuota,
}: {
  userName: string;
  initialQuota: QuotaState;
}) {
  const { lang } = useLang();
  const id = lang === "id";

  const [input, setInput] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [author, setAuthor] = useState<AnalyticsAuthor | null>(null);
  const [videos, setVideos] = useState<AnalyticsVideo[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [quota, setQuota] = useState<QuotaState>(initialQuota);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });

  const [pcStatus, setPcStatus] = useState<PCStatus | null>(null);
  const [pcFailed, setPcFailed] = useState(false);

  /**
   * Daftarkan perangkat SEBELUM halaman ini bisa dipakai.
   *
   * Cookie ul_device hanya terbit dari /api/user/pc-check. Sebelumnya hanya
   * dashboard yang memanggilnya, jadi pelanggan yang cuma membeli Analytics
   * — atau siapa pun yang masuk langsung ke /analytics — selalu ditolak
   * /api/analytics dengan "perangkat tidak terdaftar", tanpa jalan keluar.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pc = await registerDevice();
      if (cancelled) return;
      if (!pc) setPcFailed(true);
      else setPcStatus(pc);
    })();
    return () => { cancelled = true; };
  }, []);

  const deviceAllowed = pcStatus?.allowed === true;

  const summary = useMemo(() => summarize(videos), [videos]);
  const trend = useMemo(() => monthlyTrend(videos), [videos]);
  const hours = useMemo(() => hourPattern(videos), [videos]);
  const days = useMemo(() => dayPattern(videos), [videos]);

  const sorted = useMemo(() => {
    const val = (v: AnalyticsVideo): number => {
      switch (sort.key) {
        case "views": return v.views;
        case "likes": return v.likes;
        case "comments": return v.comments;
        case "shares": return v.shares;
        case "er": return engagementRate(v) ?? -1;
        default: return v.createdAt ?? 0;
      }
    };
    return [...videos].sort((a, b) => (sort.dir === "desc" ? val(b) - val(a) : val(a) - val(b)));
  }, [videos, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  /**
   * Ambil data satu akun.
   *
   * Dua langkah, bukan satu: POST memulai run di Apify lalu langsung kembali,
   * dan GET menanyakan hasilnya berkala. Menunggu run selesai di dalam satu
   * permintaan akan melewati batas waktu fungsi Vercel — run 3 video saja
   * butuh ~8 detik, 30 video lebih lama lagi.
   *
   * `limit` menggantikan cursor: satu run mengambil N video terbaru, jadi
   * "Muat lagi" berarti run baru dengan N lebih besar dan hasilnya menggantikan
   * daftar sebelumnya — tidak ada penggabungan halaman.
   */
  async function run(username: string) {
    setLoading(true);
    setError("");

    const startedAt = Date.now();
    setElapsed(0);
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);

    const showFail = (d: { error?: string; detail?: string }) => {
      const base = d.error || (id ? "Gagal mengambil data." : "Failed to fetch data.");
      setError(d.detail ? `${base}\n\n[dev] ${d.detail}` : base);
    };

    try {
      const startRes = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const start = await startRes.json();
      if (start.quota) setQuota(start.quota);
      if (!start.ok) {
        showFail(start);
        setVideos([]); setAuthor(null); setAccount(null);
        return;
      }

      let page = start.done ? start.data : null;

      if (!page) {
        // ~45 × 2,5 detik ≈ 110 detik. Lebih dari itu berarti ada yang salah
        // di sisi penyedia, bukan sekadar lambat.
        for (let i = 0; i < 45 && !page; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          const res = await fetch(`/api/analytics?runId=${encodeURIComponent(start.runId)}`);
          const d = await res.json();
          if (d.ok && d.done) { page = d.data; break; }
          if (res.status !== 202) { showFail(d); return; }
        }
        if (!page) {
          setError(id
            ? "Pengambilan data terlalu lama. Coba lagi sebentar lagi."
            : "The fetch took too long. Please try again shortly.");
          return;
        }
      }

      setAccount(username);
      setAuthor(page.author ?? null);
      setVideos(page.videos);
    } catch {
      setError(id ? "Gagal terhubung ke server." : "Failed to reach the server.");
    } finally {
      clearInterval(tick);
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = input.trim();
    if (!clean || !canAnalyze) return;
    setVideos([]); setAuthor(null);
    void run(clean.replace(/^@/, ""));
  }

  /**
   * Library-nya baru diunduh saat tombol ditekan — halaman tidak ikut berat.
   * Dipilih write-excel-file (2 paket, tanpa dependensi dalam) ketimbang
   * exceljs (90 paket, beberapa sudah deprecated): untuk sekadar menulis satu
   * berkas, beban rantai pasoknya tidak sepadan.
   */
  async function exportExcel() {
    if (videos.length === 0) return;
    setExporting(true);
    try {
      const writeXlsxFile = (await import("write-excel-file/browser")).default;

      const head = (t: string): CellObject => ({ value: t, type: String, fontWeight: "bold" });

      const videoSheet: SheetData = [
        ["Tanggal", "Judul", "Durasi (detik)", "Views", "Likes", "Komentar", "Share", "Favorit", "Repost", "ER (%)", "URL"].map(head),
        ...sorted.map((v): Row => [
          v.createdAt ? { value: new Date(v.createdAt * 1000), type: Date, format: "dd/mm/yyyy" } : null,
          { value: v.title || "", type: String },
          { value: v.durationSec ?? undefined, type: Number },
          { value: v.views, type: Number },
          { value: v.likes, type: Number },
          { value: v.comments, type: Number },
          { value: v.shares, type: Number },
          { value: v.favorites, type: Number },
          { value: v.reposts, type: Number },
          { value: engagementRate(v) ?? undefined, type: Number },
          { value: v.url, type: String },
        ]),
      ];

      const ringkasanSheet: SheetData = [
        ["Metrik", "Nilai"].map(head),
        ...([
          ["Akun", `@${account ?? ""}`],
          ["Video dianalisis", fmtFull(summary.videos)],
          ["Total views", fmtFull(summary.totalViews)],
          ["Total likes", fmtFull(summary.totalLikes)],
          ["Total komentar", fmtFull(summary.totalComments)],
          ["Total share", fmtFull(summary.totalShares)],
          ["Rata-rata views", fmtFull(summary.avgViews)],
          ["Median views", fmtFull(summary.medianViews)],
          ["Rata-rata ER", summary.avgER !== null ? `${summary.avgER}%` : "—"],
          ["Diambil pada", new Date().toLocaleString("id-ID")],
        ] as [string, string][]).map(([k, v]): Row => [
          { value: k, type: String },
          { value: v, type: String },
        ]),
      ];

      await writeXlsxFile(
        [
          {
            data: videoSheet,
            sheet: "Video",
            stickyRowsCount: 1,
            columns: [
              { width: 12 }, { width: 60 }, { width: 14 }, { width: 12 }, { width: 12 },
              { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 52 },
            ],
          },
          {
            data: ringkasanSheet,
            sheet: "Ringkasan",
            stickyRowsCount: 1,
            columns: [{ width: 26 }, { width: 24 }],
          },
        ]
      ).toFile(`unwanted-labs-analytics-${account ?? "tiktok"}.xlsx`);
    } catch {
      setError(id ? "Gagal membuat berkas Excel." : "Failed to build the Excel file.");
    } finally {
      setExporting(false);
    }
  }

  const quotaLeft = Math.max(0, quota.limit - quota.dayCount);
  const canAnalyze = deviceAllowed && (quota.exempt || quotaLeft > 0);

  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "6281234567890";
  const waResetUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    "Halo, saya perlu reset perangkat UNWANTED LABS karena ganti PC"
  )}`;

  const COLS: { key: SortKey; label: string }[] = [
    { key: "date", label: id ? "Tanggal" : "Date" },
    { key: "views", label: "Views" },
    { key: "likes", label: "Likes" },
    { key: "comments", label: id ? "Komentar" : "Comments" },
    { key: "shares", label: "Share" },
    { key: "er", label: "ER" },
  ];

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className="wrap">
          <div className={`${styles.pageHeader} animate-in`}>
            <div className={styles.pageHeaderSub}>UNWANTED LABS — TikTok Analytics</div>
            <h1 className={styles.pageHeaderTitle}><SplitText lines={[{ text: userName }]} stagger={0.03} /></h1>
          </div>
          <div className={styles.rule} />

          {pcFailed ? (
            <div className={`${styles.gateCard} animate-in`}>
              <p className={styles.gateDesc}>
                {id
                  ? "Gagal memeriksa perangkat. Periksa koneksi internetmu, lalu muat ulang halaman ini."
                  : "Device check failed. Check your connection, then reload this page."}
              </p>
              <div className={styles.gateActions}>
                <a href="/analytics" className="btn">{id ? "Muat Ulang" : "Reload"}</a>
              </div>
            </div>
          ) : pcStatus === null ? (
            <div className={styles.checkingRow}>
              <div className="spinner" style={{ width: 18, height: 18 }} />
              <span>{id ? "Memeriksa perangkat" : "Checking device"}</span>
            </div>
          ) : !deviceAllowed ? (
            <div className={`${styles.gateCard} animate-in`}>
              <p className={styles.gateDesc}>
                {pcStatus.reason || (id ? "Akun ini sudah terdaftar di komputer lain." : "This account is already registered on another computer.")}
                <br />
                {id
                  ? "Satu lisensi berlaku untuk satu komputer. Minta admin mereset perangkatmu bila kamu ganti PC."
                  : "One license covers one computer. Ask the admin to reset your device if you changed PCs."}
              </p>
              <div className={styles.gateActions}>
                <a href={waResetUrl} target="_blank" rel="noopener noreferrer" className="btn btn-wa" style={{ padding: "14px 20px" }}>
                  {id ? "Minta Reset PC" : "Request PC Reset"}
                </a>
              </div>
            </div>
          ) : (
          <>
          <form onSubmit={onSubmit} className={`${styles.searchCard} animate-in`}>
            <div className={styles.searchRow}>
              <span className={styles.atSign}>@</span>
              <input
                id="tt-username"
                className={`input ${styles.searchInput}`}
                type="text"
                placeholder={id ? "username tiktok" : "tiktok username"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={!canAnalyze}
              />
              <button type="submit" className={`btn ${styles.searchBtn}`} disabled={loading || !canAnalyze || !input.trim()}>
                {loading ? <div className="spinner" style={{ width: 12, height: 12 }} /> : (id ? "Analisis" : "Analyze")}
              </button>
            </div>
            <p className={styles.searchHint}>
              {id
                ? "Boleh username saja, dengan @, atau link profil TikTok-nya."
                : "Username, with @, or the TikTok profile link — all work."}
            </p>

            {/* Jatah harian ada demi mengendalikan biaya penyedia data, jadi
                angkanya ditampilkan terbuka — pelanggan tidak perlu menebak
                kenapa tombolnya mati. */}
            <div className={styles.quotaRow}>
              {quota.exempt ? (
                <span className={styles.quotaFree}>
                  {id ? "Admin — tanpa batas harian" : "Admin — no daily limit"}
                </span>
              ) : (
                <>
                  <span className={quotaLeft === 0 ? styles.quotaOut : undefined}>
                    {id
                      ? `${quotaLeft} dari ${quota.limit} analisis tersisa hari ini`
                      : `${quotaLeft} of ${quota.limit} analyses left today`}
                  </span>
                  {quotaLeft === 0 && (
                    <span className={styles.quotaReset}>
                      {id ? "Jatah baru mulai tengah malam WIB" : "Resets at midnight WIB"}
                    </span>
                  )}
                </>
              )}
              <span className={styles.quotaMonth}>
                {id
                  ? `${quota.monthCount} kali bulan ini`
                  : `${quota.monthCount} this month`}
              </span>
            </div>
            {loading && (
              <div className={styles.progressRow}>
                <div className="spinner" style={{ width: 14, height: 14 }} />
                <span>
                  {id ? "Mengambil data dari penyedia" : "Fetching from provider"} — {elapsed}s
                  {elapsed > 12 && (id ? " (biasanya 15–30 detik)" : " (usually 15–30s)")}
                </span>
              </div>
            )}
            {error && <div className={styles.errorMsg}>{error}</div>}
          </form>

          {videos.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyLabel}>UNWANTED LABS — Analytics</div>
              <h2 className={styles.emptyTitle}>{id ? "Bedah Performa Akun TikTok" : "Break Down a TikTok Account"}</h2>
              <p className={styles.emptyDesc}>
                {id
                  ? "Views, likes, komentar, dan share per video — plus tren per bulan dan pola jam unggah."
                  : "Views, likes, comments and shares per video — plus monthly trend and posting-hour patterns."}
              </p>
            </div>
          )}

          {videos.length > 0 && (
            <div className="animate-in">
              {/* ── Kepala akun ── */}
              <div className={styles.accountBar}>
                <div>
                  <div className={styles.accountHandle}>
                    @{author?.uniqueId ?? account}
                    {author?.verified && <span className={styles.verified}>VERIFIED</span>}
                  </div>
                  {author?.nickname && <div className={styles.accountName}>{author.nickname}</div>}
                  {author && (author.followers !== null || author.totalLikes !== null) && (
                    <div className={styles.accountStats}>
                      {author.followers !== null && <span>{fmtFull(author.followers)} {id ? "pengikut" : "followers"}</span>}
                      {author.totalLikes !== null && <span>{fmtNum(author.totalLikes)} {id ? "total suka" : "total likes"}</span>}
                      {author.videoCount !== null && <span>{fmtFull(author.videoCount)} {id ? "video" : "videos"}</span>}
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-ghost" onClick={exportExcel} disabled={exporting}>
                  {exporting ? <div className="spinner" style={{ width: 12, height: 12 }} /> : null}
                  {id ? "Ekspor Excel" : "Export Excel"}
                </button>
              </div>

              {/* ── Ringkasan ── */}
              <div className={styles.statGrid}>
                <div className={styles.statCell}>
                  <div className={styles.statK}>{id ? "Video Dianalisis" : "Videos Analyzed"}</div>
                  <div className={styles.statV}>{summary.videos}</div>
                </div>
                <div className={styles.statCell}>
                  <div className={styles.statK}>Total Views</div>
                  <div className={styles.statV}>{fmtNum(summary.totalViews)}</div>
                </div>
                <div className={styles.statCell}>
                  <div className={styles.statK}>{id ? "Rata-rata Views" : "Avg Views"}</div>
                  <div className={styles.statV}>{fmtNum(summary.avgViews)}</div>
                </div>
                <div className={styles.statCell}>
                  <div className={styles.statK}>{id ? "Rata-rata ER" : "Avg ER"}</div>
                  <div className={styles.statV}>{summary.avgER !== null ? `${summary.avgER}%` : "—"}</div>
                </div>
              </div>

              {/* Median sengaja ditampilkan di samping rata-rata: kalau keduanya
                  jauh berbeda, berarti performa akun ditopang sedikit video viral. */}
              <p className={styles.medianNote}>
                {id ? "Median views" : "Median views"}: <b>{fmtFull(summary.medianViews)}</b>
                {summary.avgViews > summary.medianViews * 2 && summary.medianViews > 0 && (
                  <>
                    {" — "}
                    {id
                      ? "jauh di bawah rata-rata, jadi angka rata-ratanya ditarik oleh beberapa video viral."
                      : "well below the average, so a few viral videos are pulling the mean up."}
                  </>
                )}
              </p>

              {/* ── Terbaik & terburuk ── */}
              {(summary.best || summary.worst) && (
                <div className={styles.extremeGrid}>
                  {summary.best && (
                    <div className={styles.extremeCard}>
                      <div className={styles.extremeLabel}>{id ? "Video Terbaik" : "Best Video"}</div>
                      <a href={summary.best.url} target="_blank" rel="noopener noreferrer" className={styles.extremeTitle}>
                        {summary.best.title || "(tanpa judul)"}
                      </a>
                      <div className={styles.extremeMeta}>
                        {fmtFull(summary.best.views)} views · {fmtDate(summary.best.createdAt, id)}
                      </div>
                    </div>
                  )}
                  {summary.worst && (
                    <div className={styles.extremeCard}>
                      <div className={styles.extremeLabel}>{id ? "Video Terlemah" : "Weakest Video"}</div>
                      <a href={summary.worst.url} target="_blank" rel="noopener noreferrer" className={styles.extremeTitle}>
                        {summary.worst.title || "(tanpa judul)"}
                      </a>
                      <div className={styles.extremeMeta}>
                        {fmtFull(summary.worst.views)} views · {fmtDate(summary.worst.createdAt, id)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Grafik ── */}
              <div className={styles.sectionTitle}>{id ? "Tren per Bulan" : "Monthly Trend"}</div>
              <TrendChart points={trend.map((t) => ({ label: t.label, avgViews: t.avgViews, videos: t.videos, avgER: t.avgER }))} />

              <div className={styles.chartGrid}>
                <div>
                  <div className={styles.sectionTitle}>{id ? "Pola Jam Unggah" : "Posting Hour"}</div>
                  <BarsChart data={hours} labelEvery={3} caption={id ? "Rata-rata views per jam unggah (waktu perangkatmu)" : "Average views by posting hour (your device time)"} />
                </div>
                <div>
                  <div className={styles.sectionTitle}>{id ? "Pola Hari Unggah" : "Posting Day"}</div>
                  <BarsChart data={days} caption={id ? "Rata-rata views per hari unggah" : "Average views by posting day"} />
                </div>
              </div>

              {/* ── Tabel ── */}
              <div className={styles.sectionTitle}>{id ? "Semua Video" : "All Videos"}</div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.thTitle}>{id ? "Judul" : "Title"}</th>
                      {COLS.map((c) => (
                        <th key={c.key}>
                          <button type="button" className={styles.sortBtn} onClick={() => toggleSort(c.key)}>
                            {c.label}
                            <span className={styles.sortMark}>
                              {sort.key === c.key ? (sort.dir === "desc" ? "▼" : "▲") : ""}
                            </span>
                          </button>
                        </th>
                      ))}
                      <th>{id ? "Durasi" : "Length"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((v) => {
                      const er = engagementRate(v);
                      return (
                        <tr key={v.id}>
                          <td className={styles.tdTitle}>
                            <a href={v.url} target="_blank" rel="noopener noreferrer" title={v.title}>
                              {v.title || "(tanpa judul)"}
                            </a>
                            {v.isPinned && <span className={styles.pin}>PIN</span>}
                          </td>
                          <td className={styles.tdNum}>{fmtDate(v.createdAt, id)}</td>
                          <td className={styles.tdNum}>{fmtFull(v.views)}</td>
                          <td className={styles.tdNum}>{fmtFull(v.likes)}</td>
                          <td className={styles.tdNum}>{fmtFull(v.comments)}</td>
                          <td className={styles.tdNum}>{fmtFull(v.shares)}</td>
                          <td className={styles.tdNum}>{er !== null ? `${er}%` : "—"}</td>
                          <td className={styles.tdNum}>{fmtDur(v.durationSec)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.loadMoreRow}>
                <span className={styles.chartHint}>
                  {id
                    ? `Menampilkan ${videos.length} video terbaru dari akun ini.`
                    : `Showing the latest ${videos.length} videos from this account.`}
                </span>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </main>
    </>
  );
}
