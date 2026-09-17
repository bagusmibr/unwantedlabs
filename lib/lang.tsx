"use client";
import { createContext, useContext, useState } from "react";

export type Lang = "id" | "en";

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "id",
  setLang: () => {},
});

/**
 * Bahasa awal datang dari cookie yang dibaca server (lihat app/layout.tsx),
 * bukan dari localStorage di dalam useEffect. Bedanya terasa: halaman tidak
 * lagi dirender "id" dulu lalu berkedip ke "en" saat hidrasi.
 */
export function LangProvider({
  initialLang = "id",
  children,
}: {
  initialLang?: Lang;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = (l: Lang) => {
    setLangState(l);
    // Cookie supaya server tahu pilihannya pada kunjungan berikutnya.
    document.cookie = `ul_lang=${l}; path=/; max-age=31536000; samesite=lax`;
    // Atribut lang ikut berubah tanpa menunggu muat ulang.
    document.documentElement.lang = l;
  };

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function t(id: Record<"id" | "en", string>, lang: Lang) {
  return id[lang];
}
