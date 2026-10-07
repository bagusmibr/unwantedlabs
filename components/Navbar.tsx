"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./Navbar.module.css";
import { useLang } from "@/lib/lang";
import { AnnouncementBar } from "@/components/SiteContent";

type NavUser = { email: string; name: string; isAdmin: boolean };

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<NavUser | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { lang, setLang } = useLang();
  const id = lang === "id";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Identitas HANYA datang dari server. Tidak ada lagi bayangan di
  // localStorage: nilai lama di situ pernah membuat navbar menampilkan
  // pemilik akun sebelumnya di komputer bersama.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) setUser({ email: d.email, name: d.name || d.email, isAdmin: !!d.isAdmin });
        else setUser(null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  // Tutup menu saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }, [router]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/inspector", label: "Inspector" },
    { href: "/status", label: "Status" },
  ];

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.announce}><AnnouncementBar /></div>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" className={styles.logo}>
          <Image src="/logo_small.png" alt="UNWANTED LABS" width={120} height={20} priority />
          <span className={styles.logoSub}>LABS</span>
        </Link>

        <div className={styles.links}>
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`${styles.link} ${pathname === l.href ? styles.active : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className={styles.right}>
          <button
            type="button"
            className={styles.langToggle}
            onClick={() => setLang(id ? "en" : "id")}
            aria-label={id ? "Ganti bahasa ke Inggris" : "Switch language to Indonesian"}
          >
            <span className={id ? styles.langActive : styles.langInactive}>ID</span>
            <span className={styles.langSep}>|</span>
            <span className={!id ? styles.langActive : styles.langInactive}>EN</span>
          </button>

          {/* Sebelum status server tiba, slot ini dibiarkan kosong agar tidak
              berkedip antara "Masuk/Daftar" dan nama pengguna. */}
          {!ready ? (
            <div className={styles.authPlaceholder} aria-hidden="true" />
          ) : user ? (
            <div className={styles.userMenu} ref={menuRef}>
              <button
                type="button"
                className={styles.userTrigger}
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className={styles.avatar}>{(user.name || user.email || "U")[0].toUpperCase()}</span>
                <span className={styles.userName}>{user.name?.split(" ")[0]}</span>
              </button>
              {menuOpen && (
                <div className={styles.dropdown} role="menu">
                  <Link href="/dashboard" className={styles.dropItem} role="menuitem" onClick={() => setMenuOpen(false)}>
                    Dashboard
                  </Link>
                  {/* Sengaja di dropdown, bukan di nav utama: halamannya berbayar,
                      jadi hanya masuk akal untuk yang sudah punya akun. */}
                  <Link href="/analytics" className={styles.dropItem} role="menuitem" onClick={() => setMenuOpen(false)}>
                    Analytics
                  </Link>
                  {user.isAdmin && (
                    <Link href="/admin" className={styles.dropItem} role="menuitem" onClick={() => setMenuOpen(false)}>
                      Admin
                    </Link>
                  )}
                  <div className={styles.dropLine} />
                  {/* Logout mencabut refresh token, jadi sesi di perangkat lain
                      ikut mati. Labelnya dibuat jujur soal itu. */}
                  <button type="button" className={styles.dropItem} role="menuitem" onClick={handleLogout}>
                    {id ? "Keluar dari semua perangkat" : "Sign out everywhere"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className={styles.authLink}>{id ? "Masuk" : "Login"}</Link>
              <Link href="/register" className={`btn ${styles.registerBtn}`}>
                {id ? "Daftar" : "Sign Up"}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className={`${styles.navLine} ${scrolled ? styles.navLineVisible : ""}`} />
    </nav>
  );
}
