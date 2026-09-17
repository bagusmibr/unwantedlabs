import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const { uid } = await req.json();
    if (typeof uid !== "string" || !uid) {
      return NextResponse.json({ ok: false, error: "UID tidak valid" }, { status: 400 });
    }

    const adminDb = await getAdminDb();
    const userRef = adminDb.collection("users").doc(uid);

    // Hapus perangkat terdaftar sekaligus riwayat percobaan PC lain.
    for (const sub of ["devices", "deviceAttempts"]) {
      const snap = await userRef.collection(sub).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }

    // Ringkasan di dokumen user harus ikut dikosongkan, kalau tidak panel
    // masih menampilkan IP lama sampai user itu login lagi.
    await userRef.set(
      { deviceCount: 0, attemptCount: 0, devices: [], pcResetAt: new Date(), pcResetBy: admin.email || "admin" },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin/reset-pc error:", e);
    return NextResponse.json({ ok: false, error: "Gagal reset PC" }, { status: 500 });
  }
}
