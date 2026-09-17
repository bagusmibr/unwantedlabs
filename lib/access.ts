/**
 * Satu-satunya tempat yang memutuskan siapa boleh apa.
 *
 * Berkas ini sengaja TIDAK mengimpor firebase-admin, supaya aman diimpor dari
 * komponen klien juga (panel admin butuh tipe dan labelnya).
 */

export const FEATURES = ["mp4", "analytics"] as const;
export type Feature = (typeof FEATURES)[number];

export interface Access {
  /** MP4 Patch Engine — produk pertama, sudah dijual. */
  mp4: boolean;
  /** TikTok Analytics — produk kedua. */
  analytics: boolean;
}

export const NO_ACCESS: Access = { mp4: false, analytics: false };

/** Label yang dipakai panel admin dan halaman harga. */
export const FEATURE_LABEL: Record<Feature, string> = {
  mp4: "MP4 Optimizer",
  analytics: "TikTok Analytics",
};

export function isFeature(v: unknown): v is Feature {
  return v === "mp4" || v === "analytics";
}

/**
 * Baca akses per fitur dari dokumen user.
 *
 * KOMPATIBILITAS MUNDUR — ini bagian pentingnya. Pelanggan lama hanya punya
 * `hasAccess: true` dan tidak punya objek `access` sama sekali. Mereka harus
 * tetap bisa memakai MP4 Optimizer tanpa kamu menyentuh satu dokumen pun di
 * Firestore. Jadi:
 *
 *   - tidak ada `access`            → mp4 = hasAccess lama, analytics = false
 *   - ada `access` tapi mp4 kosong  → mp4 tetap jatuh ke hasAccess lama
 *   - ada `access.mp4`             → itu yang menang
 */
export function readAccess(data: Record<string, unknown> | undefined | null): Access {
  const legacyMp4 = data?.hasAccess === true;
  const raw = data?.access;

  if (raw && typeof raw === "object") {
    const a = raw as Record<string, unknown>;
    return {
      mp4: a.mp4 === true || (a.mp4 === undefined && legacyMp4),
      analytics: a.analytics === true,
    };
  }

  return { mp4: legacyMp4, analytics: false };
}

/** Benar kalau user punya setidaknya satu produk berbayar. */
export function hasAnyAccess(access: Access): boolean {
  return access.mp4 || access.analytics;
}
