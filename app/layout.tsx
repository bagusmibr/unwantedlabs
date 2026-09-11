import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/lang";
import SecurityGuard from "@/components/SecurityGuard";

export const metadata: Metadata = {
  title: "UNWANTED LABS — TikTok Studio",
  description: "Professional video optimization tools for TikTok creators. Patch MP4 for 120fps, Video Inspector, and more.",
  keywords: "tiktok, video, fps, 120fps, studio, patch, mp4",
  openGraph: {
    title: "UNWANTED LABS",
    description: "Professional TikTok video optimization tools",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="bg-orbs" aria-hidden="true">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
        <LangProvider>
          <SecurityGuard />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}

