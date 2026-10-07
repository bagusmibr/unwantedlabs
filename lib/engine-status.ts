/**
 * Status engine MP4 — dipakai bersama oleh route API, panel admin, studio, dan
 * halaman publik. Berkas ini tidak boleh mengimpor apa pun dari server
 * (firebase-admin dsb.) karena ikut dibundel ke browser.
 *
 * Disimpan di Firestore:
 *   config/engineStatus   status yang berlaku sekarang
 *   engineStatusLog/{id}  riwayat setiap perubahan (untuk panel & /status)
 */

export type EngineState =
  | "online"
  | "degraded"
  | "testing"
  | "patched"
  | "maintenance"
  | "offline";

export type Tone = "ok" | "warn" | "info" | "beta" | "bad" | "off";

type L = { id: string; en: string };

export interface StateMeta {
  label: L;
  /** Kalimat default bila admin tidak menulis pesan sendiri. */
  desc: L;
  tone: Tone;
  /** Nilai awal "blokir engine" saat admin memilih status ini. Tetap bisa
   *  diubah manual — ini hanya saran yang masuk akal. */
  defaultBlock: boolean;
}

/** Urutan di sini = urutan kartu di panel admin. */
export const ENGINE_STATES: EngineState[] = [
  "online",
  "degraded",
  "testing",
  "patched",
  "maintenance",
  "offline",
];

export const STATE_META: Record<EngineState, StateMeta> = {
  online: {
    label: { id: "Online", en: "Online" },
    desc: {
      id: "Engine berjalan normal. Video hasil patch lolos 120fps di TikTok.",
      en: "Engine is running normally. Patched videos pass 120fps on TikTok.",
    },
    tone: "ok",
    defaultBlock: false,
  },
  degraded: {
    label: { id: "Gangguan Sebagian", en: "Partial Outage" },
    desc: {
      id: "Sebagian video tidak lolos 120fps. Kami sedang memantau — hasil bisa bervariasi.",
      en: "Some videos aren't passing 120fps. We're monitoring — results may vary.",
    },
    tone: "warn",
    defaultBlock: false,
  },
  testing: {
    label: { id: "Uji Coba", en: "Testing" },
    desc: {
      id: "Metode baru sedang diuji. Engine bisa dipakai, tapi hasilnya belum dijamin.",
      en: "A new method is being tested. The engine works, but results aren't guaranteed yet.",
    },
    tone: "beta",
    defaultBlock: false,
  },
  patched: {
    label: { id: "Di-patch TikTok", en: "Patched by TikTok" },
    desc: {
      id: "TikTok menutup metode ini. Video hasil patch saat ini tidak lolos 120fps. Kami sedang mencari metode baru.",
      en: "TikTok closed this method. Patched videos currently don't pass 120fps. We're working on a new method.",
    },
    tone: "bad",
    defaultBlock: true,
  },
  maintenance: {
    label: { id: "Maintenance", en: "Maintenance" },
    desc: {
      id: "Engine sedang diperbarui. Studio akan kembali sebentar lagi.",
      en: "The engine is being updated. The studio will be back shortly.",
    },
    tone: "info",
    defaultBlock: true,
  },
  offline: {
    label: { id: "Offline", en: "Offline" },
    desc: {
      id: "Engine dimatikan sementara.",
      en: "The engine is temporarily turned off.",
    },
    tone: "off",
    defaultBlock: true,
  },
};

export interface EngineStatus {
  state: EngineState;
  /** Pesan bebas dari admin. Kosong = pakai STATE_META[state].desc. */
  message: string;
  /** true = /api/engine menolak pelanggan (admin tetap lolos untuk menguji). */
  blockEngine: boolean;
  /** Perkiraan pulih, epoch ms. null = tidak ditampilkan. */
  eta: number | null;
  /** epoch ms; null bila belum pernah diatur. */
  updatedAt: number | null;
}

export interface EngineStatusLogEntry extends EngineStatus {
  id: string;
  /** Email admin yang mengubah. Hanya diisi untuk panel admin, tidak pernah
   *  untuk /api/status yang publik. */
  by?: string;
}

export const DEFAULT_STATUS: EngineStatus = {
  state: "online",
  message: "",
  blockEngine: false,
  eta: null,
  updatedAt: null,
};

export const MESSAGE_MAX = 400;

export function isEngineState(v: unknown): v is EngineState {
  return typeof v === "string" && (ENGINE_STATES as string[]).includes(v);
}

/** Firestore Timestamp, Date, angka, atau string → epoch ms. */
function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  const o = v as { toMillis?: () => number; _seconds?: number; seconds?: number };
  if (typeof o.toMillis === "function") return o.toMillis();
  if (typeof o._seconds === "number") return o._seconds * 1000;
  if (typeof o.seconds === "number") return o.seconds * 1000;
  return null;
}

/** Baca dokumen apa pun (termasuk yang belum ada / rusak) jadi bentuk aman. */
export function readEngineStatus(raw: unknown): EngineStatus {
  const r = (raw ?? {}) as Record<string, unknown>;
  const state = isEngineState(r.state) ? r.state : DEFAULT_STATUS.state;
  return {
    state,
    message: String(r.message ?? "").slice(0, MESSAGE_MAX),
    blockEngine: typeof r.blockEngine === "boolean" ? r.blockEngine : STATE_META[state].defaultBlock,
    eta: toMs(r.eta),
    updatedAt: toMs(r.updatedAt),
  };
}

/** Pesan yang benar-benar ditampilkan ke pelanggan. */
export function statusMessage(s: EngineStatus, lang: "id" | "en"): string {
  return s.message.trim() || STATE_META[s.state].desc[lang];
}

/** "3 menit lalu" / "3 minutes ago" — tanpa pustaka tambahan. */
export function timeAgo(ms: number | null, lang: "id" | "en", now = Date.now()): string {
  if (!ms) return "—";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  const rtf = new Intl.RelativeTimeFormat(lang === "id" ? "id-ID" : "en-US", { numeric: "auto" });
  if (s < 60) return rtf.format(-s, "second");
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.round(m / 60);
  if (h < 48) return rtf.format(-h, "hour");
  return rtf.format(-Math.round(h / 24), "day");
}

export function fmtDateTime(ms: number | null, lang: "id" | "en"): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(lang === "id" ? "id-ID" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
