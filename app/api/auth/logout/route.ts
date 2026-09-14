import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

/**
 * Cookie "session" di-set httpOnly, jadi JavaScript di browser TIDAK BISA
 * menghapusnya. Logout wajib lewat server.
 */
export async function POST(req: NextRequest) {
  const session = req.cookies.get("session")?.value;

  // Cabut refresh token supaya sesi lama benar-benar mati di semua perangkat.
  if (session) {
    try {
      const adminAuth = await getAdminAuth();
      const decoded = await adminAuth.verifySessionCookie(session, false);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Cookie rusak / kedaluwarsa — tetap lanjut hapus cookie-nya.
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
