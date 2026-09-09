"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./Navbar.module.css";
import { useLang } from "@/lib/lang";

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string; isAdmin?: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { lang, setLang } = useLang();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ul_user");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
  }, []);

  const navLinks = [
    { href: "/", label: lang === "id" ? "Home" : "Home" },
    { href: "/inspector", label: "Inspector" },
  ];

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <div className={`wrap ${styles.inner}`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <Image src="/logo_small.png" alt="UNWANTED LABS" width={120} height={20} priority />
          <span className={styles.logoSub}>LABS</span>
        </Link>

        {/* Links */}
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

        {/* Right */}
        <div className={styles.right}>
          {/* Language Toggle */}
          <button
            className={styles.langToggle}
            onClick={() => setLang(lang === "id" ? "en" : "id")}
            title="Switch Language"
          >
            <span className={lang === "id" ? styles.langActive : styles.langInactive}>ID</span>
            <span className={styles.langSep}>|</span>
            <span className={lang === "en" ? styles.langActive : styles.langInactive}>EN</span>
          </button>

          {user ? (
            <div className={styles.userMenu} onClick={() => setMenuOpen(!menuOpen)}>
              <div className={styles.avatar}>{(user.name || user.email || "U")[0].toUpperCase()}</div>
              <span className={styles.userName}>{user.name?.split(" ")[0]}</span>
              {menuOpen && (
                <div className={styles.dropdown}>
                  <Link href="/dashboard" className={styles.dropItem} onClick={() => setMenuOpen(false)}>
                    Dashboard
                  </Link>
                  {user.isAdmin && (
                    <Link href="/admin" className={styles.dropItem} onClick={() => setMenuOpen(false)}>Admin</Link>
                  )}
                  <div className={styles.dropLine} />
                  <button
                    className={styles.dropItem}
                    onClick={() => {
                      localStorage.removeItem("ul_user");
                      document.cookie = "session=; max-age=0; path=/";
                      window.location.href = "/";
                    }}
                  >
                    {lang === "id" ? "Logout" : "Sign Out"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className={styles.authLink}>{lang === "id" ? "Masuk" : "Login"}</Link>
              <Link href="/register" className="btn" style={{ padding: "10px 20px", fontSize: 10 }}>
                {lang === "id" ? "Daftar" : "Sign Up"}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Animated bottom line */}
      <div className={`${styles.navLine} ${scrolled ? styles.navLineVisible : ""}`} />
    </nav>
  );
}
