import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const adminDb = await getAdminDb();
    const snap = await adminDb.collection("users").orderBy("createdAt", "desc").limit(200).get();

    const users = await Promise.all(
      snap.docs.map(async (d) => {
        const [devicesSnap, attemptsSnap] = await Promise.all([
          adminDb.collection("users").doc(d.id).collection("devices").get(),
          adminDb.collection("users").doc(d.id).collection("deviceAttempts").get(),
        ]);

        const devices = devicesSnap.docs.map((dev) => ({
          fingerprint: dev.id,
          ip: dev.data().ip || "—",
          userAgent: dev.data().userAgent || "",
          firstSeen: dev.data().firstSeen || null,
          lastSeen: dev.data().lastSeen || null,
        }));

        return { uid: d.id, ...d.data(), devices, attemptCount: attemptsSnap.size };
      })
    );

    return NextResponse.json({ ok: true, users });
  } catch (e) {
    console.error("admin/users error:", e);
    return NextResponse.json({ ok: false, error: "Gagal memuat data" }, { status: 500 });
  }
}
