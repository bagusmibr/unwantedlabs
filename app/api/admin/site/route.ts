import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSiteContent, setSiteContent } from "@/lib/site-content-server";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, data: await getSiteContent({ fresh: true }) });
  } catch (e) {
    console.error("admin site GET error:", e);
    return NextResponse.json({ ok: false, error: "Gagal membaca konten" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Body tidak sah" }, { status: 400 });
  }
  try {
    const data = await setSiteContent(body, admin.email || "admin");
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("admin site POST error:", e);
    return NextResponse.json({ ok: false, error: "Gagal simpan" }, { status: 500 });
  }
}
