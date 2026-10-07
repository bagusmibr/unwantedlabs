# UNWANTED LABS — Web

Situs jualan + panel untuk **UNWANTED LABS**: MP4 Patch Engine (berbayar) dan
Video Inspector (gratis). Next.js 16 App Router, Firebase Auth + Firestore,
deploy di Vercel.

---

## Menjalankan di lokal

```bash
npm install
cp .env.local.example .env.local   # lalu isi nilainya
npm run dev                        # http://localhost:3000
```

Perintah lain:

```bash
npm run build     # build produksi
npm run lint      # eslint
npx tsc --noEmit  # cek tipe
```

---

## Variabel lingkungan

Semuanya ada di `.env.local.example`. Yang wajib:

| Variabel | Untuk apa |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Konfigurasi Firebase klien (aman dibaca browser) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Service account untuk Admin SDK — **rahasia** |
| `ADMIN_EMAILS` | Email yang boleh membuka `/admin`, pisahkan dengan koma |
| `NEXT_PUBLIC_WA_NUMBER` | Nomor WhatsApp admin, tanpa `+` dan tanpa spasi |
| `NEXT_PUBLIC_SITE_URL` | Domain produksi, dipakai metadata + `robots.txt` + `sitemap.xml` |
| `APIFY_TOKEN` | Token Apify untuk TikTok Analytics — **rahasia**, tanpa awalan `NEXT_PUBLIC_` |

`FIREBASE_PRIVATE_KEY` disalin apa adanya dari JSON service account, termasuk
`\n`-nya — kode sudah menormalkan tanda kutip dan escape-nya.

**Menambah admin:** tambahkan emailnya ke `ADMIN_EMAILS` lalu redeploy. Tidak
ada daftar admin di database; `lib/firebase-admin.ts` hanya membaca env ini.

---

## Peta folder

```
app/
  page.tsx              landing (harga diambil dari /api/admin/pricing)
  inspector/            Video Inspector — gratis, tanpa login
  login/ register/      Firebase Auth (email/password + Google)
  dashboard/
    page.tsx            server component: baca hasAccess dari Firestore
    studio-client.tsx   UI studio, memuat engine dari /api/engine
  analytics/            TikTok Analytics (berbayar, terpisah dari MP4)
  admin/                panel: kelola akses, lihat perangkat, status engine, harga
  status/               halaman publik status engine + riwayat
  api/
    engine/             ⚠ menyajikan mesin berbayar — lihat di bawah
    auth/               buat & hapus session cookie
    user/               status akun, pendaftaran perangkat
    admin/              daftar user, beri/cabut akses, reset PC, harga
    inspector/          ambil metadata TikTok + deteksi FPS
    analytics/          TikTok Analytics — mulai run Apify, tanya hasilnya
engine/                 mp4.js & boost.js — JANGAN pindah ke public/
lib/                    auth, firebase, bahasa, akses per produk
  tiktok-source.ts      SATU-SATUNYA modul yang tahu soal penyedia data
firestore.rules         tolak semua akses klien (wajib di-deploy)
proxy.ts                saringan cookie murah, BUKAN lapisan keamanan
```

---

## Cara keamanannya bekerja

Tiga lapis, dan hanya dua di antaranya yang benar-benar menjaga:

1. **`proxy.ts`** — hanya mengecek cookie `session` ada atau tidak, supaya
   pengunjung yang jelas belum login tidak membangunkan server component.
   **Jangan pernah mengandalkan ini untuk keamanan.**
2. **Layout server** (`app/admin/layout.tsx`, `app/dashboard/layout.tsx`) —
   memverifikasi session cookie ke Firebase, termasuk `checkRevoked` dan status
   verifikasi email.
3. **Route handler** — setiap endpoint memverifikasi sendiri lewat
   `getSessionUser()` / `requireAdmin()`.

### Mesin berbayar

`engine/mp4.js` dan `engine/boost.js` **tidak boleh** diletakkan di `public/`.
Sebagai aset statis, keduanya bisa diunduh siapa pun tanpa akun — itu sama saja
membagikan produknya gratis. Sekarang keduanya dikirim `GET /api/engine`, yang
baru merespons kalau: sesi sah, `hasAccess === true`, dan cookie `ul_device`
cocok dengan perangkat terdaftar user itu.

`next.config.ts` punya `outputFileTracingIncludes` untuk `/api/engine` supaya
folder `engine/` ikut ter-deploy ke fungsi Vercel. Kalau baris itu hilang,
route-nya jalan di lokal tapi 500 di produksi.

Perlu dicatat jujur: JavaScript yang jalan di browser tidak bisa dibuat mustahil
disalin. Pelanggan yang sudah bayar tetap bisa menyimpan isinya dari DevTools.
Yang ditutup di sini adalah pembajakan semudah membuka satu URL.

### Lisensi 1 PC

`POST /api/user/pc-check` menerbitkan UUID acak ke cookie `ul_device`
(`httpOnly`) dan mendaftarkannya di `users/{uid}/devices`. Kuotanya 1. Percobaan
dari komputer lain dicatat di `users/{uid}/deviceAttempts` dan muncul di panel
admin sebagai kolom **PC lain coba** — itulah sinyal akun dibagikan, karena
kolom jumlah PC selalu maksimal 1.

Pelanggan yang ganti PC harus minta admin menekan **Reset PC**. Belum ada tombol
reset mandiri.

### Status engine

Panel admin → tab **Engine**. Ada enam status: Online, Gangguan Sebagian, Uji
Coba, Di-patch TikTok, Maintenance, Offline. Tiap perubahan disimpan di
`config/engineStatus` dan dicatat di koleksi `engineStatusLog`.

- Sakelar **Kunci studio** membuat `/api/engine` menolak pelanggan (503). Admin
  tetap menerima engine supaya bisa menguji perbaikan sebelum dibuka lagi.
- Status tampil publik di landing (pill + peringatan di atas harga), di studio
  (banner), dan di halaman `/status` beserta riwayatnya.
- `GET /api/status` publik dan tidak pernah memuat email admin; email pengubah
  hanya muncul di riwayat panel admin.

### Firestore rules

Jalankan ini sekali, dan cek ulang setelah tiap perubahan di Console:

```bash
firebase deploy --only firestore:rules
```

Admin SDK melewati rules, jadi menolak semua akses klien tidak merusak apa pun.

---

## Yang masih terbuka

- **Ganti PC mandiri** — sekarang masih manual lewat panel admin (M4 di QC).
- **Inspector masih memakai tikwm.com**, dan tikwm sekarang memasang Cloudflare —
  permintaan dari server dibalas halaman tantangan bot. Kalau Inspector ikut
  gagal di produksi, pindahkan juga ke Apify seperti Analytics.
- **Analytics bergantung pada Apify** (berbayar per pemakaian). Tiap pengambilan
  yang tidak kena cache = satu run berbayar. Jangan jual Analytics sebagai
  *lifetime*: pemasoknya bisa berubah harga atau berhenti kapan saja.
- **Sesi tidak diperpanjang** — cookie berumur 14 hari (batas maksimum
  Firebase); setelah itu pelanggan harus login lagi.

---

Dibuat oleh Bagus (Shifted) MIBR.
