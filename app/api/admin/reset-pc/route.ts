import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, isAdmin } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    const adminUser = await adminAuth().getUser(decoded.uid);
    if (!isAdmin(adminUser.email)) return NextResponse.json({ ok: false }, { status: 403 });

    const { uid } = await req.json();
    const devicesRef = adminDb().collection("users").doc(uid).collection("devices");
    const snap = await devicesRef.get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
