import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getEngineStatus, getEngineStatusHistory, setEngineStatus } from "@/lib/engine-status-server";

/** Status sekarang + 20 riwayat terakhir, untuk tab Engine di panel admin. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const [status, history] = await Promise.all([
      getEngineStatus({ fresh: true }),
      getEngineStatusHistory(20, { includeBy: true }),
    ]);
    return NextResponse.json({ ok: true, data: status, history });
  } catch (e) {
    console.error("engine-status GET error:", e);
    return NextResponse.json({ ok: false, error: "Gagal membaca status" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak sah" }, { status: 400 });
  }

  try {
    const data = await setEngineStatus(body, admin.email || "admin");
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = (e as Error)?.message || "Gagal simpan";
    // Error validasi dari setEngineStatus → 400; selain itu masalah server.
    const isValidation = msg === "Status tidak dikenal." || msg === "Format ETA tidak sah.";
    if (!isValidation) console.error("engine-status POST error:", e);
    return NextResponse.json({ ok: false, error: isValidation ? msg : "Gagal simpan" }, { status: isValidation ? 400 : 500 });
  }
}
