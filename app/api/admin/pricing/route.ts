import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, isAdmin } from "@/lib/firebase-admin";

async function getUid(req: NextRequest): Promise<string | null> {
  const session = req.cookies.get("session")?.value;
  if (!session) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    return decoded.uid;
  } catch { return null; }
}

// GET — public read for landing page pricing
export async function GET() {
  try {
    const snap = await adminDb().collection("config").doc("pricing").get();
    if (!snap.exists) {
      return NextResponse.json({
        ok: true,
        data: { normalPrice: 0, discountPrice: 0, discountActive: false, discountLabel: "", waNumber: process.env.NEXT_PUBLIC_WA_NUMBER || "" },
      });
    }
    return NextResponse.json({ ok: true, data: snap.data() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Gagal membaca harga" }, { status: 500 });
  }
}

// POST — admin only
export async function POST(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth().getUser(uid);
  if (!isAdmin(decoded.email)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  await adminDb().collection("config").doc("pricing").set({
    normalPrice: Number(body.normalPrice) || 0,
    discountPrice: Number(body.discountPrice) || 0,
    discountActive: !!body.discountActive,
    discountLabel: String(body.discountLabel || ""),
    waNumber: String(body.waNumber || ""),
    updatedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
