import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUserFromCookies } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { readAccess } from "@/lib/access";
import { peekQuota, type QuotaState } from "@/lib/quota";
import Navbar from "@/components/Navbar";
import AnalyticsClient from "./analytics-client";
import styles from "./analytics.module.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "TikTok Analytics — UNWANTED LABS" };

/**
 * Gerbangnya di server, sama seperti dashboard. Klien tidak pernah jadi sumber
 * kebenaran soal siapa yang sudah bayar — dan /api/analytics memeriksa ulang
 * sendiri, jadi mengakali halaman ini tidak membuka data apa pun.
 */
export default async function AnalyticsPage() {
  // redirect() bekerja dengan melempar error — jangan di dalam try/catch.
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/login?next=/analytics");

  let allowed = false;
  let lookupFailed = false;
  let quota: QuotaState | null = null;
  try {
    const adminDb = await getAdminDb();
    const snap = await adminDb.collection("users").doc(user.uid).get();
    allowed = readAccess(snap.data()).analytics;
    if (allowed) quota = await peekQuota(user.uid, user.isAdmin);
  } catch (e) {
    console.error("analytics status error:", e);
    lookupFailed = true;
  }

  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "6281234567890";
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    "Halo, saya ingin membeli TikTok Analytics (UNWANTED LABS)"
  )}`;

  if (lookupFailed || !allowed || !quota) {
    return (
      <>
        <Navbar />
        <main className={styles.main}>
          <div className="wrap">
            <div className={`${styles.pageHeader} animate-in`}>
              <div className={styles.pageHeaderSub}>UNWANTED LABS — TikTok Analytics</div>
              <h1 className={styles.pageHeaderTitle}>
                {lookupFailed ? "Status Tidak Terbaca" : "Akses Belum Aktif"}
              </h1>
            </div>
            <div className={styles.rule} />

            <div className={`${styles.gateCard} animate-in`}>
              <p className={styles.gateDesc}>
                {lookupFailed
                  ? "Kami tidak bisa membaca status akunmu sekarang. Muat ulang halaman ini sebentar lagi."
                  : "Akunmu belum punya akses ke TikTok Analytics. Hubungi admin via WhatsApp untuk aktivasi."}
              </p>
              <div className={styles.gateActions}>
                {lookupFailed ? (
                  <Link href="/analytics" className="btn">Muat Ulang</Link>
                ) : (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn btn-wa" style={{ padding: "14px 20px" }}>
                    Chat Admin via WhatsApp
                  </a>
                )}
                <Link href="/dashboard" className="btn btn-ghost">Ke Dashboard</Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <AnalyticsClient
      userName={user.name || user.email?.split("@")[0] || "Studio"}
      initialQuota={quota}
    />
  );
}
