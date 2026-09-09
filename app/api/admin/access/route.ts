import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdmin } from "@/lib/firebase-admin";

async function requireAdmin(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return null;
  try {
    const adminAuth = await getAdminAuth();
    const decoded = await adminAuth.verifySessionCookie(session, true);
    const user = await adminAuth.getUser(decoded.uid);
    if (!isAdmin(user.email)) return null;
    return decoded.uid;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const adminUid = await requireAdmin(req);
  if (!adminUid) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { uid, action } = await req.json();
  if (!uid || !action) return NextResponse.json({ ok: false, error: "Missing params" }, { status: 400 });

  const adminAuth = await getAdminAuth();
  const adminUser = await adminAuth.getUser(adminUid);
  const adminDb = await getAdminDb();

  await adminDb.collection("users").doc(uid).update({
    hasAccess: action === "grant",
    accessGrantedAt: action === "grant" ? new Date() : null,
    accessGrantedBy: action === "grant" ? (adminUser.email || "admin") : null,
  });

  return NextResponse.json({ ok: true });
}
