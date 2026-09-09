import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ ok: false, hasAccess: false }, { status: 401 });
  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    const snap = await adminDb().collection("users").doc(decoded.uid).get();
    const data = snap.data();
    return NextResponse.json({ ok: true, hasAccess: data?.hasAccess ?? false, uid: decoded.uid });
  } catch {
    return NextResponse.json({ ok: false, hasAccess: false }, { status: 500 });
  }
}
