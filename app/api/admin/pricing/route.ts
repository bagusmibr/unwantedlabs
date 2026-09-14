import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";

interface PricingShape {
  normalPrice: number;
  discountPrice: number;
  discountActive: boolean;
  discountLabel: string;
  waNumber: string;
}

const DEFAULTS: PricingShape = {
  normalPrice: 0,
  discountPrice: 0,
  discountActive: false,
  discountLabel: "",
  waNumber: "",
};

/** GET sengaja publik — landing page butuh harga. Field di-whitelist supaya
 *  penambahan field internal di dokumen config/pricing tidak ikut bocor. */
export async function GET() {
  try {
    const adminDb = await getAdminDb();
    const snap = await adminDb.collection("config").doc("pricing").get();
    const raw = (snap.exists ? snap.data() : null) ?? {};

    const data: PricingShape = {
      normalPrice: Number(raw.normalPrice) || 0,
      discountPrice: Number(raw.discountPrice) || 0,
      discountActive: !!raw.discountActive,
      discountLabel: String(raw.discountLabel ?? ""),
      waNumber: String(raw.waNumber ?? process.env.NEXT_PUBLIC_WA_NUMBER ?? ""),
    };

    return NextResponse.json({ ok: true, data: snap.exists ? data : { ...DEFAULTS, waNumber: data.waNumber } });
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

    await adminDb.collection("config").doc("pricing").set({
      normalPrice: Math.max(0, Number(body.normalPrice) || 0),
      discountPrice: Math.max(0, Number(body.discountPrice) || 0),
      discountActive: !!body.discountActive,
      discountLabel: String(body.discountLabel || "").slice(0, 120),
      waNumber: String(body.waNumber || "").replace(/[^0-9]/g, "").slice(0, 20),
      updatedAt: new Date(),
      updatedBy: admin.email || "admin",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("pricing POST error:", e);
    return NextResponse.json({ ok: false, error: "Gagal simpan" }, { status: 500 });
  }
}
