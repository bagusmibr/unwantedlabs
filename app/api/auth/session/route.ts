import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdmin } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ ok: false, error: "Token tidak valid." }, { status: 400 });
    }

    const adminAuth = await getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token, true);

    // GERBANG: cek verifikasi email HARUS di server. Pengecekan di
    // login/page.tsx bisa dilewati dengan memanggil Firebase REST langsung.
    if (!decoded.email_verified) {
      return NextResponse.json(
        { ok: false, error: "Email belum diverifikasi. Silakan cek kotak masuk kamu." },
        { status: 403 }
      );
    }

    // 14 hari adalah batas maksimum session cookie Firebase. Dinaikkan dari 5
    // hari karena tidak ada mekanisme perpanjangan: pelanggan aktif sebelumnya
    // dikeluarkan setiap 5 hari tanpa alasan yang terlihat.
    const expiresIn = 60 * 60 * 24 * 14 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(token, { expiresIn });

    const adminStatus = isAdmin(decoded.email);

    // Pastikan user ada di Firestore
    const adminDb = await getAdminDb();
    const userRef = adminDb.collection("users").doc(decoded.uid);
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
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    });
    return res;
  } catch (e: unknown) {
    // Detail error hanya untuk log server — jangan dikirim ke klien.
    console.error("Session error:", e);
    return NextResponse.json({ ok: false, error: "Gagal membuat sesi." }, { status: 401 });
  }
}
