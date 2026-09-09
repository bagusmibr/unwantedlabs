import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    const decoded = await adminAuth().verifyIdToken(token);
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth().createSessionCookie(token, { expiresIn });

    const { isAdmin, adminDb } = await import("@/lib/firebase-admin");
    const adminStatus = isAdmin(decoded.email);

    // Ensure user exists in Firestore
    const userRef = adminDb().collection("users").doc(decoded.uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      await userRef.set({
        email: decoded.email,
        name: decoded.name || decoded.email?.split("@")[0] || "User",
        hasAccess: false,
        accessGrantedAt: null,
        createdAt: new Date(),
      });
    }

    const res = NextResponse.json({ ok: true, isAdmin: adminStatus });
    res.cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 5,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }
}
