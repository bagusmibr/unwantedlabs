import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Jatah pemakaian TikTok Analytics.
 *
 * Ini bukan pembatas laju teknis, melainkan pengendali biaya: satu pengambilan
 * yang tidak kena cache sama dengan satu run Apify berbayar. Karena itu
 * hitungannya disimpan permanen per akun, bukan di memori instance.
 */

export const DAILY_LIMIT = 2;

export interface QuotaState {
  /** Sudah terpakai hari ini (WIB). */
  dayCount: number;
  /** Sudah terpakai bulan berjalan (WIB). */
  monthCount: number;
  limit: number;
  /** Admin tetap dicatat, hanya tidak pernah ditolak. */
  exempt: boolean;
  allowed: boolean;
}

/**
 * Kunci hari & bulan menurut WIB, bukan UTC.
 *
 * Kalau memakai UTC, jatah pelanggan Indonesia akan reset jam 7 pagi — waktu
 * yang tidak masuk akal buat mereka. "en-CA" dipakai karena formatnya YYYY-MM-DD.
 */
function wibKeys(now = new Date()): { day: string; month: string } {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { day, month: day.slice(0, 7) };
}

function rollOver(
  data: Record<string, unknown> | undefined,
  keys: { day: string; month: string }
): { dayCount: number; monthCount: number } {
  const sameDay = data?.day === keys.day;
  const sameMonth = data?.month === keys.month;
  return {
    dayCount: sameDay && typeof data?.dayCount === "number" ? data.dayCount : 0,
    monthCount: sameMonth && typeof data?.monthCount === "number" ? data.monthCount : 0,
  };
}

/** Lihat jatah tanpa memakainya. Dipakai halaman untuk menampilkan sisa. */
export async function peekQuota(uid: string, exempt: boolean): Promise<QuotaState> {
  const keys = wibKeys();
  try {
    const adminDb = await getAdminDb();
    const snap = await adminDb.collection("analyticsQuota").doc(uid).get();
    const { dayCount, monthCount } = rollOver(snap.data(), keys);
    return { dayCount, monthCount, limit: DAILY_LIMIT, exempt, allowed: exempt || dayCount < DAILY_LIMIT };
  } catch (e) {
    console.error("peekQuota error:", e);
    // Gagal baca bukan alasan memblokir; POST tetap memeriksa ulang.
    return { dayCount: 0, monthCount: 0, limit: DAILY_LIMIT, exempt, allowed: true };
  }
}

/**
 * Pakai satu jatah. Kembalikan allowed=false bila sudah habis.
 *
 * Transaksi dipakai supaya dua tab yang menekan tombol bersamaan tidak
 * dua-duanya lolos dan menagih dua run.
 *
 * Kalau Firestore bermasalah, sengaja fail-CLOSED — kebalikan dari pembatas
 * laju Inspector. Di sana menolak permintaan cuma merepotkan; di sini
 * meloloskannya berarti membakar saldo Apify tanpa terhitung.
 */
export async function consumeQuota(uid: string, exempt: boolean): Promise<QuotaState> {
  const keys = wibKeys();
  try {
    const adminDb = await getAdminDb();
    const ref = adminDb.collection("analyticsQuota").doc(uid);

    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const { dayCount, monthCount } = rollOver(snap.data(), keys);

      if (!exempt && dayCount >= DAILY_LIMIT) {
        return { dayCount, monthCount, limit: DAILY_LIMIT, exempt, allowed: false };
      }

      const next = { dayCount: dayCount + 1, monthCount: monthCount + 1 };
      tx.set(ref, { ...keys, ...next, lastUsedAt: Date.now() }, { merge: true });
      return { ...next, limit: DAILY_LIMIT, exempt, allowed: true };
    });
  } catch (e) {
    console.error("consumeQuota error:", e);
    if (exempt) {
      return { dayCount: 0, monthCount: 0, limit: DAILY_LIMIT, exempt, allowed: true };
    }
    return { dayCount: DAILY_LIMIT, monthCount: 0, limit: DAILY_LIMIT, exempt, allowed: false };
  }
}

/**
 * Kembalikan jatah yang sudah terlanjur dipotong.
 * Dipakai bila run gagal dimulai — pelanggan tidak boleh kehilangan jatah
 * untuk sesuatu yang tidak pernah berjalan dan tidak menagih apa pun.
 */
export async function refundQuota(uid: string): Promise<void> {
  const keys = wibKeys();
  try {
    const adminDb = await getAdminDb();
    const ref = adminDb.collection("analyticsQuota").doc(uid);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const { dayCount, monthCount } = rollOver(snap.data(), keys);
      tx.set(
        ref,
        { ...keys, dayCount: Math.max(0, dayCount - 1), monthCount: Math.max(0, monthCount - 1) },
        { merge: true }
      );
    });
  } catch (e) {
    console.error("refundQuota error:", e);
  }
}
