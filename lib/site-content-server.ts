// Hanya untuk route handler — mengimpor firebase-admin.
import { getAdminDb } from "@/lib/firebase-admin";
import { readSiteContent, type SiteContent } from "@/lib/site-content";

const COL = "config";
const DOC = "siteContent";

/** Banner dibaca di setiap halaman; cache singkat per instance memangkas
 *  bacaan Firestore. Penyimpanan admin langsung memperbarui cache ini. */
const MEMO_MS = 15_000;
let memo: { at: number; value: SiteContent } | null = null;

export async function getSiteContent(opts: { fresh?: boolean } = {}): Promise<SiteContent> {
  if (!opts.fresh && memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  const db = await getAdminDb();
  const snap = await db.collection(COL).doc(DOC).get();
  const value = readSiteContent(snap.exists ? snap.data() : null);
  memo = { at: Date.now(), value };
  return value;
}

export async function setSiteContent(body: unknown, by: string): Promise<SiteContent> {
  const clean = readSiteContent(body);
  const prev = await getSiteContent({ fresh: true });
  // Versi naik setiap kali isi pengumuman berubah, sehingga pengunjung yang
  // sudah menutup pengumuman lama tetap melihat yang baru.
  const a = clean.announcement, p = prev.announcement;
  const changed =
    a.active !== p.active || a.text.id !== p.text.id || a.text.en !== p.text.en ||
    a.link !== p.link || a.tone !== p.tone;
  clean.announcement.version = changed ? p.version + 1 : p.version;

  const db = await getAdminDb();
  await db.collection(COL).doc(DOC).set({ ...clean, updatedAt: new Date(), updatedBy: by });
  memo = { at: Date.now(), value: clean };
  return clean;
}
