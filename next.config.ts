import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["firebase-admin", "tiktok-video-scraper", "got"],
  poweredByHeader: false,
  // Sumber mesin dibaca dengan fs saat runtime, jadi berkasnya harus ikut
  // dipaketkan ke fungsi /api/engine. Tanpa baris ini, route-nya jalan di lokal
  // tapi 500 di Vercel karena engine/ tidak ikut ter-deploy.
  outputFileTracingIncludes: {
    "/api/engine": ["./engine/**/*"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "**.tiktokcdn.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // CSP sengaja dibatasi pada direktif yang benar-benar menambah
          // perlindungan tanpa risiko merusak halaman. script-src dan style-src
          // TIDAK dipasang: Next menyuntikkan skrip inline, dan dashboard
          // menjalankan engine lewat new Function() — CSP yang terpaksa memakai
          // 'unsafe-inline' + 'unsafe-eval' hanya memberi rasa aman palsu.
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
          },
        ],
      },
      {
        // Panel dan API tidak boleh di-cache CDN.
        source: "/(admin|dashboard|api)/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
