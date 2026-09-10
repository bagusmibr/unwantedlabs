"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "../login/login.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSuccess("");
    if (password.length < 6) { setError("Password minimal 6 karakter."); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth!, email, password);
      await updateProfile(cred.user, { displayName: name });

      await sendEmailVerification(cred.user);
      await signOut(auth!); // sign out the unverified user from client

      setSuccess("Pendaftaran Berhasil! Silakan cek kotak masuk email Anda (jangan lupa cek folder Spam / Junk) untuk memverifikasi akun sebelum login.");
      setLoading(false);
    } catch (err: unknown) {
      console.log("REGISTER ERROR:", err);
      const code = (err as { code?: string })?.code;
      setError(code === "auth/email-already-in-use" ? "Email sudah terdaftar." : "Pendaftaran gagal. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Image src="/logo_small.png" alt="UNWANTED LABS" width={160} height={28} />
        </div>

        <div className={styles.heading}>
          <div className={styles.title}>UNWANTED LABS — Panel</div>
          <div className={styles.sub}>Buat Akun</div>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <div className="input-group">
            <label className="input-label">Nama</label>
            <input className="input" type="text" placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input" type="password" placeholder="Min. 6 karakter" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {success && <div className={styles.success} style={{ color: "#4caf50", fontSize: 13, marginBottom: 12 }}>{success}</div>}
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className="btn" style={{ width: "100%", padding: 14, marginTop: 4 }} disabled={loading}>
            {loading ? <div className="spinner" /> : "Buat Akun"}
          </button>
        </form>

        <p className={styles.footer}>
          Sudah punya akun? <Link href="/login">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
