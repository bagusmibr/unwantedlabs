import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Pembatas laju yang dibagi antar instance.
 *
 * Map di memori tidak berguna di Vercel: tiap instance punya hitungan sendiri
 * dan instance-nya berganti terus, jadi batasnya praktis tidak ada. Hitungannya
 * harus tinggal di satu tempat — di sini Firestore, yang memang sudah dipakai.
 */

/** Kunci harus aman dipakai sebagai id dokumen Firestore. */
export function safeDocId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 120) || "anon";
}

/**
 * Kembalikan true kalau permintaan ini HARUS ditolak.
 *
 * Sengaja fail-open kalau Firestore bermasalah: memutus layanan untuk semua
 * orang lebih merugikan daripada melewatkan beberapa permintaan.
 */
export async function rateLimited(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  try {
    const adminDb = await getAdminDb();
    const ref = adminDb.collection("rateLimits").doc(safeDocId(key));

    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const data = snap.data();

      if (!data || typeof data.resetAt !== "number" || now > data.resetAt) {
        tx.set(ref, { count: 1, resetAt: now + windowMs });
        return false;
      }

      const count = typeof data.count === "number" ? data.count : 0;
      if (count >= limit) return true;

      tx.update(ref, { count: count + 1 });
      return false;
    });
  } catch (e) {
    console.error("rate limit error:", e);
    return false;
  }
}
