import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

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

  // process.cwd() menunjuk ke root fungsi di Vercel dan ke root proyek saat
  // dev. Kandidat kedua menutup kasus monorepo/standalone output.
  const candidates = [
    path.join(process.cwd(), "engine"),
    path.join(process.cwd(), "..", "engine"),
  ];

  let lastErr: unknown = null;
  for (const dir of candidates) {
    try {
      const parts = ["mp4.js", "boost.js"].map((f) =>
        readFileSync(path.join(dir, f), "utf8")
      );
      cachedSource = parts.join("\n;\n");
      return cachedSource;
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(
    `Sumber engine tidak ditemukan di: ${candidates.join(", ")} — ${String(lastErr)}`
  );
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

    if (userSnap.data()?.hasAccess !== true) {
      return deny(403, "Akses belum aktif.");
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
