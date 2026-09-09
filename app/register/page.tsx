"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider, sendEmailVerification, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import styles from "../login/login.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  async function saveUserAndSession(uid: string, token: string, userData: { name: string; email: string; photo: string }) {
    const res = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const data = await res.json();
    localStorage.setItem("ul_user", JSON.stringify({ ...userData, isAdmin: data.isAdmin }));
    router.push("/dashboard");
  }

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

  async function onGoogle() {
    setError(""); setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth!, new GoogleAuthProvider());
      await saveUserAndSession(cred.user.uid, await cred.user.getIdToken(), {
        name: cred.user.displayName || "", email: cred.user.email || "", photo: cred.user.photoURL || "",
      });
    } catch { setError("Daftar dengan Google gagal."); setGoogleLoading(false); }
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

        <button className={`btn ${styles.googleBtn}`} onClick={onGoogle} disabled={googleLoading}>
          {googleLoading ? <div className="spinner" /> : (
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {googleLoading ? "Menghubungkan..." : "Daftar dengan Google"}
        </button>

        <div className={styles.divider}>atau</div>

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
