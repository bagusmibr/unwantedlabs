/**
 * Konten situs yang bisa diatur admin tanpa mengubah kode:
 *   - banner pengumuman di atas semua halaman
 *   - demo before/after di landing page
 *
 * Disimpan di Firestore config/siteContent. Berkas ini ikut dibundel ke
 * browser — jangan impor apa pun dari server di sini.
 */

type L = { id: string; en: string };

export type AnnouncementTone = "info" | "promo" | "warn";

export interface Announcement {
  active: boolean;
  text: L;
  /** Tautan opsional; kosong = banner tanpa tombol. */
  link: string;
  linkLabel: L;
  tone: AnnouncementTone;
  /** Berubah setiap kali admin menyimpan — dipakai sebagai kunci "sudah
   *  ditutup" di localStorage, supaya pengumuman BARU muncul lagi. */
  version: number;
}

export interface DemoContent {
  visible: boolean;
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
  caption: L;
}

export interface SiteContent {
  announcement: Announcement;
  demo: DemoContent;
}

export const EMPTY_SITE_CONTENT: SiteContent = {
  announcement: {
    active: false,
    text: { id: "", en: "" },
    link: "",
    linkLabel: { id: "", en: "" },
    tone: "info",
    version: 0,
  },
  demo: {
    visible: false,
    beforeUrl: "",
    afterUrl: "",
    beforeLabel: "Original",
    afterLabel: "UNWANTED",
    caption: { id: "", en: "" },
  },
};

const TONES: AnnouncementTone[] = ["info", "promo", "warn"];

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const lang = (v: unknown, max: number): L => {
  const o = (v ?? {}) as Record<string, unknown>;
  return { id: str(o.id, max), en: str(o.en, max) };
};

/** Hanya http(s) atau path lokal "/..." — tidak ada javascript: dsb. */
export function safeUrl(v: unknown): string {
  const s = str(v, 500);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export function readSiteContent(raw: unknown): SiteContent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const a = (r.announcement ?? {}) as Record<string, unknown>;
  const d = (r.demo ?? {}) as Record<string, unknown>;
  const tone = TONES.includes(a.tone as AnnouncementTone) ? (a.tone as AnnouncementTone) : "info";
  return {
    announcement: {
      active: a.active === true,
      text: lang(a.text, 240),
      link: safeUrl(a.link),
      linkLabel: lang(a.linkLabel, 40),
      tone,
      version: Number(a.version) || 0,
    },
    demo: {
      visible: d.visible === true,
      beforeUrl: safeUrl(d.beforeUrl),
      afterUrl: safeUrl(d.afterUrl),
      beforeLabel: str(d.beforeLabel, 30) || EMPTY_SITE_CONTENT.demo.beforeLabel,
      afterLabel: str(d.afterLabel, 30) || EMPTY_SITE_CONTENT.demo.afterLabel,
      caption: lang(d.caption, 240),
    },
  };
}

/** Teks dalam bahasa aktif, jatuh ke bahasa lain bila kosong. */
export function pick(l: L, current: "id" | "en"): string {
  return l[current] || l[current === "id" ? "en" : "id"];
}
