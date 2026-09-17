import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isFeature, readAccess } from "@/lib/access";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const { uid, feature, action } = await req.json();
    if (typeof uid !== "string" || !uid || !isFeature(feature) || (action !== "grant" && action !== "revoke")) {
      return NextResponse.json({ ok: false, error: "Parameter tidak valid" }, { status: 400 });
    }

    const grant = action === "grant";
    const adminDb = await getAdminDb();
    const userRef = adminDb.collection("users").doc(uid);

    // Baca dulu: kalau langsung menimpa objek access, pelanggan lama yang
    // aksesnya masih berupa hasAccess boolean akan kehilangan MP4 saat kamu
    // mengaktifkan Analytics.
    const snap = await userRef.get();
    const next = { ...readAccess(snap.data()), [feature]: grant };

    const patch: Record<string, unknown> = {
      access: next,
      // hasAccess dijaga tetap sinkron dengan access.mp4 supaya apa pun yang
      // masih membaca field lama tidak ikut rusak.
      hasAccess: next.mp4,
    };

    if (feature === "mp4") {
      patch.accessGrantedAt = grant ? new Date() : null;
      patch.accessGrantedBy = grant ? admin.email || "admin" : null;
    } else {
      patch.analyticsGrantedAt = grant ? new Date() : null;
      patch.analyticsGrantedBy = grant ? admin.email || "admin" : null;
    }

    // set + merge: tidak melempar error kalau dokumen user belum ada.
    await userRef.set(patch, { merge: true });

    return NextResponse.json({ ok: true, access: next });
  } catch (e) {
    console.error("admin/access error:", e);
    return NextResponse.json({ ok: false, error: "Gagal ubah akses" }, { status: 500 });
  }
}
