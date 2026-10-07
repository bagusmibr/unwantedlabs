import { NextRequest, NextResponse } from "next/server";
import { getEngineStatus, getEngineStatusHistory } from "@/lib/engine-status-server";

/**
 * Status engine untuk publik (landing, studio, /status).
 * Tidak memuat siapa yang mengubahnya — `updatedBy` sengaja tidak pernah
 * ikut keluar dari server lewat route ini.
 *
 * ?history=1 menambahkan 10 perubahan terakhir.
 */
export async function GET(req: NextRequest) {
  try {
    const wantHistory = req.nextUrl.searchParams.get("history") === "1";
    const [status, history] = await Promise.all([
      getEngineStatus(),
      wantHistory ? getEngineStatusHistory(10) : Promise.resolve(undefined),
    ]);
    return NextResponse.json({ ok: true, data: status, ...(history ? { history } : {}) });
  } catch (e) {
    console.error("status GET error:", e);
    return NextResponse.json({ ok: false, error: "Gagal membaca status" }, { status: 500 });
  }
}
