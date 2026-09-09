import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, isAdmin } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    const user = await adminAuth().getUser(decoded.uid);
    if (!isAdmin(user.email)) return NextResponse.json({ ok: false }, { status: 403 });

    // List all users from Firestore
    const snap = await adminDb().collection("users").orderBy("createdAt", "desc").limit(200).get();
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

    return NextResponse.json({ ok: true, users });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
