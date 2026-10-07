import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { LangProvider, type Lang } from "@/lib/lang";
import { SITE_URL } from "@/lib/site";
import FxRoot from "@/components/fx/FxRoot";

// next/font menghosting Inter sendiri: tidak ada @import yang memblokir render
// dan tidak ada kedipan ganti font.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "UNWANTED LABS — TikTok Studio",
  description:
    "Optimasi MP4 untuk 120fps di TikTok tanpa re-encode, plus Video Inspector gratis. Semua proses berjalan di browser.",
  keywords: ["tiktok", "video", "fps", "120fps", "studio", "patch", "mp4", "inspector"],
  applicationName: "UNWANTED LABS",
  authors: [{ name: "Bagus (Shifted) MIBR" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "UNWANTED LABS — TikTok Studio",
    description:
      "Optimasi MP4 untuk 120fps di TikTok tanpa re-encode, plus Video Inspector gratis.",
    url: "/",
    siteName: "UNWANTED LABS",
    type: "website",
    // Dipakai saat link dibagikan di WhatsApp — jalur jualan utama.
    images: [{ url: "/logo.png", width: 520, height: 80, alt: "UNWANTED LABS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "UNWANTED LABS — TikTok Studio",
    description: "Optimasi MP4 untuk 120fps di TikTok tanpa re-encode.",
    images: ["/logo.png"],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const lang: Lang = store.get("ul_lang")?.value === "en" ? "en" : "id";

  return (
    <html lang={lang} className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Dijalankan sebelum halaman dilukis:
            - data-js: JavaScript jalan (overlay intro hanya boleh tampil bila ya,
              kalau tidak pengunjung tanpa JS terjebak di layar hitam)
            - data-intro-seen: intro landing sudah diputar di sesi ini
            suppressHydrationWarning di <html> karena atribut ini dipasang
            sebelum React mengambil alih. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.dataset.js='1';try{if(sessionStorage.getItem('ul_intro_seen'))document.documentElement.dataset.introSeen='1'}catch(e){}",
          }}
        />
      </head>
      <body>
        {/* Blok .bg-orbs / .orb sebelumnya ada di sini, tapi tidak ada satu pun
            aturan CSS-nya di proyek ini — empat div kosong tanpa efek apa pun. */}
        <LangProvider initialLang={lang}>{children}</LangProvider>
        <FxRoot />
      </body>
    </html>
  );
}
