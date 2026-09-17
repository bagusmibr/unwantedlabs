import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { readAccess } from "@/lib/access";

/**
 * GERBANG MESIN BERBAYAR.
 *
 * mp4.js dan boost.js TIDAK BOLEH kembali ke public/. Selama keduanya jadi aset
 * statis, siapa pun bisa mengunduhnya tanpa akun dan memakainya selamanya.
 * Di sini sumbernya baru dikirim setelah tiga syarat terpenuhi:
 *   1. sesi sah (cookie session terverifikasi di server),
 *   2. dokumen user punya hasAccess === true,
 *   3. cookie ul_device cocok dengan perangkat yang terdaftar di user itu.
 *
 * Catatan jujur: JavaScript yang berjalan di browser tidak bisa dibuat mustahil
 * disalin — pemakai yang sudah bayar selalu bisa menyimpan isinya. Yang berubah
 * adalah pembajakan tidak lagi semudah membuka satu URL.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEVICE_COOKIE = "ul_device";

let cachedSource: string | null = null;

function engineSource(): string {
  if (cachedSource) return cachedSource;

  // Kedua path ditulis literal dan terkurung di subfolder "engine". Ini bukan
  // sekadar gaya: kalau nama berkasnya datang dari variabel, Turbopack menandai
  // ini "dynamic filesystem access" dan menelusuri SELURUH proyek ke dalam
  // fungsi — termasuk isi public/ — sehingga deploy membengkak.
  const mp4 = readFileSync(path.join(process.cwd(), "engine", "mp4.js"), "utf8");
  const boost = readFileSync(path.join(process.cwd(), "engine", "boost.js"), "utf8");

  cachedSource = `${mp4}\n;\n${boost}`;
  return cachedSource;
}

/** Jawaban penolakan sengaja berupa JavaScript, bukan JSON, supaya pemanggil
 *  tetap menerima tipe konten yang sama apa pun hasilnya. */
function deny(status: number, message: string) {
  return new NextResponse(`throw new Error(${JSON.stringify(message)});`, {
    status,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return deny(401, "Sesi tidak sah.");

  const deviceId = req.cookies.get(DEVICE_COOKIE)?.value;
  if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
    return deny(403, "Perangkat belum terdaftar.");
  }

  try {
    const adminDb = await getAdminDb();
    const userRef = adminDb.collection("users").doc(user.uid);

    const [userSnap, deviceSnap] = await Promise.all([
      userRef.get(),
      userRef.collection("devices").doc(deviceId).get(),
    ]);

    // Engine ini milik produk MP4 Optimizer. Pelanggan yang hanya membeli
    // TikTok Analytics tidak berhak menerimanya.
    if (!readAccess(userSnap.data()).mp4) {
      return deny(403, "Akses MP4 Optimizer belum aktif.");
    }
    if (!deviceSnap.exists) {
      return deny(403, "Perangkat ini tidak terdaftar untuk akun tersebut.");
    }

    return new NextResponse(engineSource(), {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    console.error("engine error:", e);
    return deny(500, "Gagal memuat engine.");
  }
}
