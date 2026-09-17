/**
 * SATU-SATUNYA tempat di proyek ini yang tahu soal penyedia data.
 *
 * Sekarang: Apify, actor clockworks/tiktok-scraper.
 *
 * Sebelumnya tikwm.com, dan ia berhenti bekerja bukan karena rusak melainkan
 * karena memasang Cloudflare — permintaan dari server dibalas halaman tantangan
 * bot. Itulah gunanya lapisan ini diisolasi sejak awal: yang perlu ditulis
 * ulang cuma berkas ini, bukan route, halaman, atau perhitungan analisisnya.
 *
 * Jangan memanggil Apify dari mana pun selain di sini.
 */

const ACTOR = "clockworks~tiktok-scraper";
const API = "https://api.apify.com/v2";

export class SourceError extends Error {
  constructor(
    message: string,
    readonly kind: "notfound" | "blocked" | "unavailable" | "running",
    readonly detail?: string
  ) {
    super(message);
  }
}

/** Token server saja. JANGAN diberi awalan NEXT_PUBLIC_ — repo-nya publik. */
function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new SourceError("APIFY_TOKEN belum diatur di server.", "unavailable");
  return t;
}

export interface AnalyticsVideo {
  id: string;
  title: string;
  cover: string | null;
  /** Null untuk slideshow — Apify mengirim 0 di situ, dan 0 bukan durasi. */
  durationSec: number | null;
  createdAt: number | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
  reposts: number;
  isPinned: boolean;
  isSlideshow: boolean;
  isAd: boolean;
  url: string;
}

export interface AnalyticsAuthor {
  uniqueId: string;
  nickname: string | null;
  avatar: string | null;
  followers: number | null;
  totalLikes: number | null;
  videoCount: number | null;
  verified: boolean;
}

export interface UserPostsPage {
  author: AnalyticsAuthor | null;
  videos: AnalyticsVideo[];
  /** Benar bila hasilnya memenuhi kuota — kemungkinan masih ada lanjutannya. */
  hasMore: boolean;
}

export function normalizeUsername(raw: string): string | null {
  let v = (raw || "").trim();
  if (v.includes("tiktok.com")) {
    const m = v.match(/@([A-Za-z0-9._]{1,24})/);
    v = m ? m[1] : "";
  }
  v = v.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9._]{1,24}$/.test(v)) return null;
  return v;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function posOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapVideo(raw: any): AnalyticsVideo | null {
  if (!raw?.id) return null;
  const vm = raw.videoMeta ?? {};
  const author = raw.authorMeta?.name ?? "";

  return {
    id: String(raw.id),
    title: typeof raw.text === "string" ? raw.text : "",
    cover: vm.coverUrl || vm.originalCoverUrl || null,
    durationSec: posOrNull(vm.duration),
    createdAt: posOrNull(raw.createTime),
    views: num(raw.playCount),
    likes: num(raw.diggCount),
    comments: num(raw.commentCount),
    shares: num(raw.shareCount),
    favorites: num(raw.collectCount),
    reposts: num(raw.repostCount),
    isPinned: raw.isPinned === true,
    isSlideshow: raw.isSlideshow === true,
    isAd: raw.isAd === true || raw.isSponsored === true,
    url: raw.webVideoUrl || (author ? `https://www.tiktok.com/@${author}/video/${raw.id}` : ""),
  };
}

function mapAuthor(raw: any): AnalyticsAuthor | null {
  const a = raw?.authorMeta;
  if (!a?.name) return null;
  return {
    uniqueId: String(a.name),
    nickname: a.nickName ?? null,
    avatar: a.avatar ?? null,
    followers: posOrNull(a.fans),
    totalLikes: posOrNull(a.heart),
    videoCount: posOrNull(a.video),
    verified: a.verified === true,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function apify(path: string, init?: RequestInit, timeoutMs = 8000): Promise<Response> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API}${path}${sep}token=${encodeURIComponent(token())}`;
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new SourceError("Penyedia data tidak merespons.", "unavailable");
  }
}

async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.text().catch(() => "");
  const detail = `HTTP ${res.status} — ${body.slice(0, 200)}`;
  console.error("apify:", detail);

  if (res.status === 401 || res.status === 403) {
    throw new SourceError("Token Apify ditolak. Periksa APIFY_TOKEN.", "unavailable", detail);
  }
  if (res.status === 429) {
    throw new SourceError("Kuota Apify sedang penuh. Coba lagi sebentar lagi.", "blocked", detail);
  }
  throw new SourceError(fallback, "unavailable", detail);
}

/**
 * Mulai satu run dan kembalikan ID-nya — TIDAK menunggu sampai selesai.
 *
 * Actor Apify menyalakan kontainer dulu: tiga video saja butuh ~8 detik, tiga
 * puluh video lebih lama lagi. Fungsi Vercel paket Hobby mati di 10 detik, jadi
 * menunggu di sini berarti fiturnya gagal di produksi. Klien yang menanyakan
 * hasilnya berkala lewat collectUserPostsRun().
 */
export async function startUserPostsRun(username: string, limit: number): Promise<string> {
  const input = {
    profiles: [username],
    resultsPerPage: Math.min(Math.max(limit, 1), 200),
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
  };

  const res = await apify(`/acts/${ACTOR}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await fail(res, "Gagal memulai pengambilan data.");

  const json = await res.json().catch(() => null);
  const id = json?.data?.id;
  if (!id) throw new SourceError("Penyedia data tidak mengembalikan ID run.", "unavailable");
  return String(id);
}

/**
 * Ambil hasil sebuah run.
 * Melempar SourceError kind "running" selama run-nya belum selesai.
 */
export async function collectUserPostsRun(runId: string, limit: number): Promise<UserPostsPage> {
  const res = await apify(`/actor-runs/${encodeURIComponent(runId)}`);
  if (!res.ok) await fail(res, "Gagal membaca status pengambilan data.");

  const json = await res.json().catch(() => null);
  const status: string = json?.data?.status ?? "";
  const datasetId: string | undefined = json?.data?.defaultDatasetId;

  if (status === "READY" || status === "RUNNING") {
    throw new SourceError("Masih berjalan.", "running");
  }
  if (status !== "SUCCEEDED") {
    console.error("apify run status:", status);
    throw new SourceError("Pengambilan data gagal di sisi penyedia.", "unavailable", `status ${status}`);
  }
  if (!datasetId) throw new SourceError("Hasil run tidak ditemukan.", "unavailable");

  const itemsRes = await apify(
    `/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=${Math.min(limit, 200)}`,
    undefined,
    12_000
  );
  if (!itemsRes.ok) await fail(itemsRes, "Gagal membaca hasil pengambilan data.");

  const items: unknown[] = await itemsRes.json().catch(() => []);
  if (!Array.isArray(items)) throw new SourceError("Bentuk hasil tidak dikenali.", "unavailable");

  const videos = items.map((v) => mapVideo(v)).filter((v): v is AnalyticsVideo => v !== null);

  // Actor tetap SUCCEEDED untuk akun yang tidak ada — bedanya datasetnya kosong
  // atau hanya berisi objek penanda error.
  if (videos.length === 0) {
    throw new SourceError("Akun tidak ditemukan, privat, atau belum punya video publik.", "notfound");
  }

  return {
    author: mapAuthor(items[0]),
    videos,
    hasMore: videos.length >= limit,
  };
}
