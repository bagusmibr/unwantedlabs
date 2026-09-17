import Link from "next/link";
import styles from "./status.module.css";

export const metadata = { title: "Halaman Tidak Ditemukan — UNWANTED LABS" };

export default function NotFound() {
  return (
    <main className={styles.wrap}>
      <div className={styles.label}>UNWANTED LABS</div>
      <div className={styles.code}>404</div>
      <h1 className={styles.title}>Halaman Tidak Ditemukan</h1>
      <p className={styles.desc}>
        Alamat yang kamu buka tidak ada. Mungkin salah ketik, atau halamannya sudah dipindah.
        <br />
        The page you opened doesn&apos;t exist.
      </p>
      <div className={styles.actions}>
        <Link href="/" className="btn">Beranda</Link>
        <Link href="/inspector" className="btn btn-ghost">Inspector</Link>
      </div>
    </main>
  );
}
