import type { AnalyticsVideo } from "@/lib/tiktok-source";

/**
 * Perhitungan analisis — fungsi murni, tanpa jaringan dan tanpa React.
 * Semuanya dijalankan di browser dari data yang sudah ada, jadi tidak ada
 * beban server tambahan untuk grafik dan ringkasan.
 */

/** Rumus yang sama dengan Video Inspector, supaya dua fitur tidak memberi
 *  angka berbeda untuk video yang sama. */
export function engagementRate(v: AnalyticsVideo): number | null {
  if (!v.views) return null;
  const interactions = v.likes + v.comments + v.shares + v.favorites;
  if (interactions === 0) return 0;
  return Math.round((interactions / v.views) * 10000) / 100;
}

export interface Summary {
  videos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgViews: number;
  medianViews: number;
  /** Rata-rata ER per video, bukan total interaksi dibagi total views —
   *  satu video viral tidak boleh menutupi sisanya. */
  avgER: number | null;
  best: AnalyticsVideo | null;
  worst: AnalyticsVideo | null;
  firstPost: number | null;
  lastPost: number | null;
}

export function summarize(videos: AnalyticsVideo[]): Summary {
  const empty: Summary = {
    videos: 0, totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0,
    avgViews: 0, medianViews: 0, avgER: null, best: null, worst: null,
    firstPost: null, lastPost: null,
  };
  if (videos.length === 0) return empty;

  const totalViews = videos.reduce((s, v) => s + v.views, 0);
  const sortedViews = videos.map((v) => v.views).sort((a, b) => a - b);
  const mid = Math.floor(sortedViews.length / 2);
  const medianViews =
    sortedViews.length % 2 === 0
      ? Math.round((sortedViews[mid - 1] + sortedViews[mid]) / 2)
      : sortedViews[mid];

  const ers = videos.map(engagementRate).filter((n): n is number => n !== null);

  // Video terbaik/terburuk diukur dari views, dan hanya di antara yang punya
  // views — video baru dengan 0 views bukan "terburuk", cuma belum jalan.
  const withViews = videos.filter((v) => v.views > 0);
  const byViews = [...withViews].sort((a, b) => b.views - a.views);

  const times = videos.map((v) => v.createdAt).filter((t): t is number => t !== null);

  return {
    videos: videos.length,
    totalViews,
    totalLikes: videos.reduce((s, v) => s + v.likes, 0),
    totalComments: videos.reduce((s, v) => s + v.comments, 0),
    totalShares: videos.reduce((s, v) => s + v.shares, 0),
    avgViews: Math.round(totalViews / videos.length),
    medianViews,
    avgER: ers.length ? Math.round((ers.reduce((s, n) => s + n, 0) / ers.length) * 100) / 100 : null,
    best: byViews[0] ?? null,
    worst: byViews.length > 1 ? byViews[byViews.length - 1] : null,
    firstPost: times.length ? Math.min(...times) : null,
    lastPost: times.length ? Math.max(...times) : null,
  };
}

export interface MonthPoint {
  key: string;       // "2026-09"
  label: string;     // "Sep 26"
  videos: number;
  views: number;
  avgViews: number;
  avgER: number | null;
}

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function monthlyTrend(videos: AnalyticsVideo[]): MonthPoint[] {
  const buckets = new Map<string, { videos: number; views: number; ers: number[]; d: Date }>();

  for (const v of videos) {
    if (!v.createdAt) continue;
    const d = new Date(v.createdAt * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { videos: 0, views: 0, ers: [], d };
    b.videos += 1;
    b.views += v.views;
    const er = engagementRate(v);
    if (er !== null) b.ers.push(er);
    buckets.set(key, b);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, b]) => ({
      key,
      label: `${MONTH_ID[b.d.getMonth()]} ${String(b.d.getFullYear()).slice(2)}`,
      videos: b.videos,
      views: b.views,
      avgViews: Math.round(b.views / b.videos),
      avgER: b.ers.length ? Math.round((b.ers.reduce((s, n) => s + n, 0) / b.ers.length) * 100) / 100 : null,
    }));
}

export interface Bucket {
  label: string;
  videos: number;
  avgViews: number;
}

/** Jam dihitung dari waktu lokal browser — itu zona yang dipakai kreator saat
 *  memutuskan kapan mengunggah. */
export function hourPattern(videos: AnalyticsVideo[]): Bucket[] {
  const sum = Array.from({ length: 24 }, () => ({ n: 0, views: 0 }));
  for (const v of videos) {
    if (!v.createdAt) continue;
    const h = new Date(v.createdAt * 1000).getHours();
    sum[h].n += 1;
    sum[h].views += v.views;
  }
  return sum.map((b, h) => ({
    label: `${String(h).padStart(2, "0")}`,
    videos: b.n,
    avgViews: b.n ? Math.round(b.views / b.n) : 0,
  }));
}

const DAY_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function dayPattern(videos: AnalyticsVideo[]): Bucket[] {
  const sum = Array.from({ length: 7 }, () => ({ n: 0, views: 0 }));
  for (const v of videos) {
    if (!v.createdAt) continue;
    const d = new Date(v.createdAt * 1000).getDay();
    sum[d].n += 1;
    sum[d].views += v.views;
  }
  // Senin dulu — lebih alami dibaca daripada Minggu dulu.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((i) => ({
    label: DAY_ID[i],
    videos: sum[i].n,
    avgViews: sum[i].n ? Math.round(sum[i].views / sum[i].n) : 0,
  }));
}
