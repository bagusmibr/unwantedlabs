import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    const uid = decoded.uid;
    const { fingerprint, userAgent } = await req.json();

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const devicesRef = adminDb().collection("users").doc(uid).collection("devices");
    const existing = await devicesRef.get();

    // Check if this fingerprint is already registered
    const thisDevice = existing.docs.find((d) => d.id === fingerprint);

    if (thisDevice) {
      // Update last seen
      await thisDevice.ref.update({ lastSeen: new Date(), ip });
      return NextResponse.json({ ok: true, allowed: true, deviceCount: existing.size });
    }

    // New device — check limit (max 1)
    if (existing.size >= 1) {
      return NextResponse.json({ ok: true, allowed: false, deviceCount: existing.size, reason: "Akun ini sudah terdaftar di 1 PC lain." });
    }

    // Register new device
    await devicesRef.doc(fingerprint).set({
      userAgent: userAgent || "",
      ip,
      firstSeen: new Date(),
      lastSeen: new Date(),
    });

    return NextResponse.json({ ok: true, allowed: true, deviceCount: existing.size + 1 });
  } catch {
    return NextResponse.json({ ok: false, error: "Gagal cek perangkat" }, { status: 500 });
  }
}
