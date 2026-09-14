import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

const DEVICE_COOKIE = "ul_device";
const MAX_DEVICES = 1;

/**
 * Identitas perangkat diterbitkan SERVER (UUID acak di cookie httpOnly),
 * bukan dihitung browser. Fingerprint dari klien hanya disimpan sebagai
 * metadata informatif — ia tidak lagi menentukan lolos/tidaknya, karena
 * nilai yang dikirim klien selalu bisa dipalsukan.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const fingerprint = typeof body?.fingerprint === "string" ? body.fingerprint.slice(0, 64) : "";
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 256);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const adminDb = await getAdminDb();
    const userRef = adminDb.collection("users").doc(user.uid);
    const devicesRef = userRef.collection("devices");

    let deviceId = req.cookies.get(DEVICE_COOKIE)?.value;
    let issuedNewId = false;
    if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
      deviceId = randomUUID();
      issuedNewId = true;
    }

    const existing = await devicesRef.get();
    const known = existing.docs.find((d) => d.id === deviceId);

    const respond = (payload: Record<string, unknown>) => {
      const res = NextResponse.json(payload);
      res.cookies.set(DEVICE_COOKIE, deviceId!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
      return res;
    };

    // Perangkat yang sudah terdaftar → izinkan, perbarui jejaknya.
    if (known && !issuedNewId) {
      await known.ref.update({ lastSeen: new Date(), ip, userAgent, fingerprint });
      return respond({ ok: true, allowed: true, deviceCount: existing.size });
    }

    // Kuota penuh → tolak, dan catat percobaannya untuk kolom "PC lain coba".
    if (existing.size >= MAX_DEVICES) {
      await userRef
        .collection("deviceAttempts")
        .doc(deviceId)
        .set({ ip, userAgent, fingerprint, lastSeen: new Date() }, { merge: true });

      return respond({
        ok: true,
        allowed: false,
        deviceCount: existing.size,
        reason: `Akun ini sudah terdaftar di ${MAX_DEVICES} PC lain.`,
      });
    }

    // Slot kosong → daftarkan perangkat ini.
    await devicesRef.doc(deviceId).set({
      userAgent,
      ip,
      fingerprint,
      firstSeen: new Date(),
      lastSeen: new Date(),
    });

    return respond({ ok: true, allowed: true, deviceCount: existing.size + 1 });
  } catch (e) {
    console.error("pc-check error:", e);
    return NextResponse.json({ ok: false, error: "Gagal cek perangkat" }, { status: 500 });
  }
}
