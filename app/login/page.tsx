"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendMsg, setResendMsg] = useState("");

  async function handleSession(token: string, user: { email: string | null; displayName: string | null; photoURL: string | null }) {
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(
          lang === "id"
            ? `Server error: ${data.error || "Gagal membuat sesi. Coba lagi."}`
            : `Server error: ${data.error || "Failed to create session. Try again."}`
        );
        setGoogleLoading(false);
        setLoading(false);
        return;
      }
      localStorage.setItem("ul_user", JSON.stringify({
        email: user.email,
        name: user.displayName || user.email?.split("@")[0],
        photo: user.photoURL,
        isAdmin: data.isAdmin,
      }));
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(
        lang === "id"
          ? "Gagal terhubung ke server. Periksa koneksi internet kamu."
          : "Failed to connect to the server. Check your internet connection."
      );
      setGoogleLoading(false);
      setLoading(false);
    }
  }

  async function resendVerification(user: any) {
    try {
      const { sendEmailVerification } = await import("firebase/auth");
      await sendEmailVerification(user);
      setResendMsg(lang === "id" ? "Email verifikasi telah dikirim ulang." : "Verification email has been resent.");
    } catch {
      setResendMsg(lang === "id" ? "Gagal mengirim ulang email." : "Failed to resend email.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setResendMsg(""); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth!, email, password);
      if (!cred.user.emailVerified) {
        resendVerification(cred.user).then(async () => {
          await auth!.signOut();
        });
        setError(
          lang === "id"
            ? "Email belum diverifikasi. Kami telah mengirim ulang link verifikasi ke email Anda."
            : "Email not verified. We have resent the verification link to your email."
        );
        setLoading(false);
        return;
      }
      await handleSession(await cred.user.getIdToken(), cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const isInvalid = code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found";
      
      if (isInvalid) {
        setError(lang === "id" ? "Email atau password salah." : "Incorrect email or password.");
      } else {
        setError(lang === "id" ? `Login gagal: ${code || "unknown"}` : `Login failed: ${code || "unknown"}`);
      }
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(""); setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth!, provider);
      await handleSession(await cred.user.getIdToken(), cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(lang === "id" ? `Login Google gagal: ${code || "unknown error"}` : `Google login failed: ${code || "unknown error"}`);
      }
      setGoogleLoading(false);
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
          <div className={styles.sub}>{lang === "id" ? "Masuk" : "Login"}</div>
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
          {googleLoading ? (lang === "id" ? "Menghubungkan..." : "Connecting...") : (lang === "id" ? "Lanjutkan dengan Google" : "Continue with Google")}
        </button>

        <div className={styles.divider}>{lang === "id" ? "atau" : "or"}</div>

        <form onSubmit={onSubmit} className={styles.form}>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {resendMsg && <div style={{ color: "#4caf50", fontSize: 13, marginBottom: 12 }}>{resendMsg}</div>}
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className="btn" style={{ width: "100%", padding: 14, marginTop: 4 }} disabled={loading}>
            {loading ? <div className="spinner" /> : (lang === "id" ? "Masuk" : "Login")}
          </button>
        </form>

        <p className={styles.footer}>
          {lang === "id" ? "Belum punya akun?" : "Don't have an account?"} <Link href="/register">{lang === "id" ? "Daftar" : "Sign Up"}</Link>
        </p>
      </div>
    </div>
  );
}
