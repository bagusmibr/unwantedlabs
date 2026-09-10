"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "../login/login.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSuccess("");
    if (password.length < 6) { 
      setError(lang === "id" ? "Password minimal 6 karakter." : "Password must be at least 6 characters."); 
      return; 
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth!, email, password);
      await updateProfile(cred.user, { displayName: name });

      await sendEmailVerification(cred.user);
      await signOut(auth!); // sign out the unverified user from client

      setSuccess(
        lang === "id" 
          ? "Pendaftaran Berhasil! Silakan cek kotak masuk email Anda (jangan lupa cek folder Spam / Junk) untuk memverifikasi akun sebelum login."
          : "Registration successful! Please check your email inbox (and Spam/Junk folder) to verify your account before logging in."
      );
      setLoading(false);
    } catch (err: unknown) {
      console.log("REGISTER ERROR:", err);
      const code = (err as { code?: string })?.code;
      setError(
        code === "auth/email-already-in-use" 
          ? (lang === "id" ? "Email sudah terdaftar." : "Email is already registered.") 
          : (lang === "id" ? "Pendaftaran gagal. Coba lagi." : "Registration failed. Please try again.")
      );
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.langWrap}>
        <button className={styles.langToggle} onClick={() => setLang(lang === "id" ? "en" : "id")}>
          <span className={lang === "id" ? styles.langActive : styles.langInactive}>ID</span>
          <span className={styles.langSep}>|</span>
          <span className={lang === "en" ? styles.langActive : styles.langInactive}>EN</span>
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Image src="/logo_small.png" alt="UNWANTED LABS" width={160} height={28} />
        </div>

        <div className={styles.heading}>
          <div className={styles.title}>UNWANTED LABS — Panel</div>
          <div className={styles.sub}>{lang === "id" ? "Buat Akun" : "Create Account"}</div>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <div className="input-group">
            <label className="input-label">{lang === "id" ? "Nama" : "Name"}</label>
            <input className="input" type="text" placeholder={lang === "id" ? "Nama" : "Name"} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input" type="password" placeholder={lang === "id" ? "Min. 6 karakter" : "Min. 6 characters"} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {success && <div className={styles.success} style={{ color: "#4caf50", fontSize: 13, marginBottom: 12 }}>{success}</div>}
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className="btn" style={{ width: "100%", padding: 14, marginTop: 4 }} disabled={loading}>
            {loading ? <div className="spinner" /> : (lang === "id" ? "Buat Akun" : "Create Account")}
          </button>
        </form>

        <p className={styles.footer}>
          {lang === "id" ? "Sudah punya akun?" : "Already have an account?"} <Link href="/login">{lang === "id" ? "Masuk" : "Login"}</Link>
        </p>
      </div>
    </div>
  );
}
