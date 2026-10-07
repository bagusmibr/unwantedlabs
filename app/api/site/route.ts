import { NextResponse } from "next/server";
import { getSiteContent } from "@/lib/site-content-server";

/** Konten publik: banner pengumuman + demo before/after. */
export async function GET() {
  try {
    const data = await getSiteContent();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("site GET error:", e);
    return NextResponse.json({ ok: false, error: "Gagal membaca konten" }, { status: 500 });
  }
}
