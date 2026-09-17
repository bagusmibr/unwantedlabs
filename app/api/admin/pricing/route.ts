import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { readProduct, type PricingShape, type ProductPricing } from "@/lib/pricing";

function cleanProduct(raw: unknown): ProductPricing {
  const p = readProduct(raw);
  return {
    normalPrice: Math.max(0, p.normalPrice),
    discountPrice: Math.max(0, p.discountPrice),
    discountActive: p.discountActive,
    discountLabel: p.discountLabel.slice(0, 120),
  };
}

/** GET sengaja publik — landing page butuh harga. Field di-whitelist supaya
 *  penambahan field internal di dokumen config/pricing tidak ikut bocor. */
export async function GET() {
  try {
    const adminDb = await getAdminDb();
    const snap = await adminDb.collection("config").doc("pricing").get();
    const raw = (snap.exists ? snap.data() : null) ?? {};

    // Bentuk lama menyimpan satu harga sebagai field datar di akar dokumen.
    // Kalau objek `mp4` belum ada, harga lama itu diperlakukan sebagai harga
    // MP4 Optimizer — jadi kamu tidak perlu mengetik ulang apa pun.
    const legacy = !raw.mp4;

    const data: PricingShape = {
      mp4: legacy ? readProduct(raw) : readProduct(raw.mp4),
      analytics: readProduct(raw.analytics),
      waNumber: String(raw.waNumber ?? process.env.NEXT_PUBLIC_WA_NUMBER ?? ""),
      analyticsVisible: raw.analyticsVisible === true,
    };

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("pricing GET error:", e);
    return NextResponse.json({ ok: false, error: "Gagal membaca harga" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const adminDb = await getAdminDb();

    const mp4 = cleanProduct(body?.mp4);
    const analytics = cleanProduct(body?.analytics);

    await adminDb.collection("config").doc("pricing").set({
      mp4,
      analytics,
      waNumber: String(body?.waNumber || "").replace(/[^0-9]/g, "").slice(0, 20),
      analyticsVisible: body?.analyticsVisible === true,
      // Field datar lama ikut ditulis ulang dari harga MP4 supaya dokumen tetap
      // konsisten kalau ada yang membacanya dengan cara lama.
      normalPrice: mp4.normalPrice,
      discountPrice: mp4.discountPrice,
      discountActive: mp4.discountActive,
      discountLabel: mp4.discountLabel,
      updatedAt: new Date(),
      updatedBy: admin.email || "admin",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("pricing POST error:", e);
    return NextResponse.json({ ok: false, error: "Gagal simpan" }, { status: 500 });
  }
}
