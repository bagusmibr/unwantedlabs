"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import styles from "./status.module.css";

/**
 * Tanpa berkas ini, error runtime apa pun di produksi menampilkan layar
 * "Application error: a client-side exception has occurred" bawaan Next —
 * tanpa logo, tanpa penjelasan, dan tanpa jalan kembali.
 *
 * Catatan Next 16: prop-nya bernama `retry`, bukan `reset` seperti versi lama.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { lang } = useLang();
  const id = lang === "id";

  useEffect(() => {
    console.error("Kesalahan halaman:", error);
  }, [error]);

  return (
    <main className={styles.wrap}>
      <div className={styles.label}>UNWANTED LABS</div>
      <h1 className={styles.title}>{id ? "Ada yang Bermasalah" : "Something Went Wrong"}</h1>
      <p className={styles.desc}>
        {id
          ? "Halaman ini gagal dimuat. Coba lagi — kalau masih sama, kabari admin lewat WhatsApp."
          : "This page failed to load. Try again — if it persists, let the admin know on WhatsApp."}
      </p>
      {error.digest && <div className={styles.digest}>ref: {error.digest}</div>}
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={() => retry()}>
          {id ? "Coba Lagi" : "Try Again"}
        </button>
        <Link href="/" className="btn btn-ghost">
          {id ? "Ke Beranda" : "Go Home"}
        </Link>
      </div>
    </main>
  );
}
