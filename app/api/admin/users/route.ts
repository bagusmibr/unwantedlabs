import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { readAccess } from "@/lib/access";

interface DeviceSummary {
  id: string;
  ip: string;
  userAgent: string;
  firstSeen: unknown;
  lastSeen: unknown;
}

function tsToMillis(v: unknown): number {
  if (!v) return 0;
  const t = v as { toMillis?: () => number; _seconds?: number };
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t._seconds === "number") return t._seconds * 1000;
  return 0;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const adminDb = await getAdminDb();

    // orderBy("createdAt") dihapus: Firestore membuang dokumen yang tidak punya
    // field yang diurutkan, jadi user lama tanpa createdAt hilang diam-diam
    // dari panel. Urutannya dikerjakan di JavaScript saja.
    const snap = await adminDb.collection("users").limit(200).get();

    const rows = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        data,
        hasSummary: typeof data.deviceCount === "number",
      };
    });

    // Dokumen user lama belum punya ringkasan perangkat. Isi sekali di sini,
    // lalu pc-check yang menjaganya tetap mutakhir — pemuatan berikutnya
    // tidak menyentuh subkoleksi sama sekali.
    const stale = rows.filter((r) => !r.hasSummary);
    const backfilled = new Map<string, { deviceCount: number; attemptCount: number; devices: DeviceSummary[] }>();

    await Promise.all(
      stale.map(async (r) => {
        const userRef = adminDb.collection("users").doc(r.uid);
        const [devSnap, attSnap] = await Promise.all([
          userRef.collection("devices").get(),
          userRef.collection("deviceAttempts").get(),
        ]);
        const devices: DeviceSummary[] = devSnap.docs.map((dev) => {
          const dd = dev.data();
          return {
            id: dev.id,
            ip: dd.ip || "—",
            userAgent: dd.userAgent || "",
            firstSeen: dd.firstSeen || null,
            lastSeen: dd.lastSeen || null,
          };
        });
        const summary = { deviceCount: devices.length, attemptCount: attSnap.size, devices };
        backfilled.set(r.uid, summary);
        await userRef.set(summary, { merge: true });
      })
    );

    const users: Array<Record<string, unknown> & { uid: string; createdAt?: unknown }> = rows.map((r) => {
      const summary = backfilled.get(r.uid);
      const devices: DeviceSummary[] =
        summary?.devices ?? (Array.isArray(r.data.devices) ? (r.data.devices as DeviceSummary[]) : []);
      return {
        ...r.data,
        uid: r.uid,
        // Dihitung di server supaya panel tidak perlu tahu soal field lama.
        access: readAccess(r.data),
        devices,
        deviceCount: summary?.deviceCount ?? (typeof r.data.deviceCount === "number" ? r.data.deviceCount : devices.length),
        attemptCount: summary?.attemptCount ?? (typeof r.data.attemptCount === "number" ? r.data.attemptCount : 0),
      };
    });

    users.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));

    return NextResponse.json({ ok: true, users });
  } catch (e) {
    console.error("admin/users error:", e);
    return NextResponse.json({ ok: false, error: "Gagal memuat data" }, { status: 500 });
  }
}
