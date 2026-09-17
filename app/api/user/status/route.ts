import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { NO_ACCESS, readAccess, hasAnyAccess } from "@/lib/access";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, access: NO_ACCESS, hasAccess: false, isAdmin: false },
      { status: 401 }
    );
  }
  try {
    const adminDb = await getAdminDb();
    const snap = await adminDb.collection("users").doc(user.uid).get();
    const data = snap.data();
    const access = readAccess(data);

    return NextResponse.json({
      ok: true,
      access,
      // Dipertahankan agar klien versi lama yang masih membaca field ini tidak
      // ikut rusak saat dirilis.
      hasAccess: hasAnyAccess(access),
      // isAdmin datang dari server, bukan dari localStorage yang bisa diedit user.
      isAdmin: user.isAdmin,
      name: user.name || data?.name || null,
      email: user.email,
    });
  } catch (e) {
    console.error("status error:", e);
    return NextResponse.json(
      { ok: false, access: NO_ACCESS, hasAccess: false, isAdmin: false },
      { status: 500 }
    );
  }
}
