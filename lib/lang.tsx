"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Lang = "id" | "en";
const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "id",
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    const saved = localStorage.getItem("ul_lang") as Lang | null;
    if (saved === "en" || saved === "id") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("ul_lang", l);
  };

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function t(id: Record<"id" | "en", string>, lang: "id" | "en") {
  return id[lang];
}
