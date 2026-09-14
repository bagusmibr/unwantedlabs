import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const { uid, action } = await req.json();
    if (typeof uid !== "string" || (action !== "grant" && action !== "revoke")) {
      return NextResponse.json({ ok: false, error: "Parameter tidak valid" }, { status: 400 });
    }

    const grant = action === "grant";
    const adminDb = await getAdminDb();

    // set + merge: tidak melempar error kalau dokumen user belum ada.
    await adminDb.collection("users").doc(uid).set(
      {
        hasAccess: grant,
        accessGrantedAt: grant ? new Date() : null,
        accessGrantedBy: grant ? admin.email || "admin" : null,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin/access error:", e);
    return NextResponse.json({ ok: false, error: "Gagal ubah akses" }, { status: 500 });
  }
}
