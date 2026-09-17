/**
 * Skrip sekali pakai — HAPUS setelah integrasinya jadi.
 *
 * Tugasnya cuma dua: memastikan actor Apify-nya menjawab, dan menunjukkan
 * bentuk datanya apa adanya. Jangan pernah menaruh token di dalam berkas ini;
 * repo GitHub-mu publik.
 *
 * Jalankan dari folder proyek:
 *   APIFY_TOKEN=token_kamu node scripts/apify-probe.mjs shiftedwalls
 */

const token = process.env.APIFY_TOKEN;
const username = (process.argv[2] || "shiftedwalls").replace(/^@/, "");

if (!token) {
  console.error("APIFY_TOKEN belum diisi. Contoh:");
  console.error("  APIFY_TOKEN=apify_api_xxx node scripts/apify-probe.mjs shiftedwalls");
  process.exit(1);
}

const ACTOR = "clockworks~tiktok-scraper";

const input = {
  profiles: [username],
  resultsPerPage: 3,
  profileScrapeSections: ["videos"],
  profileSorting: "latest",
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  shouldDownloadSubtitles: false,
  shouldDownloadSlideshowImages: false,
};

console.log(`Menjalankan ${ACTOR} untuk @${username} ...`);
const t0 = Date.now();

const res = await fetch(
  `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&limit=3`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }
);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nHTTP ${res.status} — selesai dalam ${secs} detik`);

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.log("\nJawaban bukan JSON:\n" + text.slice(0, 800));
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.log("\nJawaban bukan array:\n" + JSON.stringify(data, null, 1).slice(0, 1200));
  process.exit(1);
}

console.log(`Jumlah item: ${data.length}`);
const first = data[0];
if (!first) {
  console.log("Kosong — actor jalan tapi tidak mengembalikan video.");
  process.exit(0);
}

console.log("\n--- NAMA FIELD ---");
console.log(Object.keys(first).join(", "));

// Nilai panjang dipangkas supaya keluarannya muat dibaca.
const trim = (k, v) => (typeof v === "string" && v.length > 100 ? v.slice(0, 100) + "…" : v);
console.log("\n--- CONTOH SATU VIDEO ---");
console.log(JSON.stringify(first, trim, 1).slice(0, 3000));
