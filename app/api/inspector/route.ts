import { NextRequest, NextResponse } from "next/server";

// ── Minimal MP4 box parser (server-side) ──────────────────────────────────
function r32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function btype(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
}
function findBox(b: Uint8Array, start: number, end: number, type: string): number {
  let i = start;
  while (i + 8 <= end) {
    const sz = r32(b, i);
    if (sz < 8) break;
    if (btype(b, i) === type) return i;
    i += sz;
  }
  return -1;
}

function parseFPS(buf: Uint8Array): number | null {
  const len = buf.length;
  const moov = findBox(buf, 0, len, "moov");
  if (moov < 0) return null;
  const moovEnd = Math.min(moov + r32(buf, moov), len);

  let trak = moov + 8;
  while (trak + 8 <= moovEnd) {
    const trakSz = r32(buf, trak);
    if (trakSz < 8) break;
    if (btype(buf, trak) === "trak") {
      const trakEnd = Math.min(trak + trakSz, moovEnd);
      const mdia = findBox(buf, trak + 8, trakEnd, "mdia");
      if (mdia >= 0) {
        const mdiaEnd = Math.min(mdia + r32(buf, mdia), trakEnd);
        // check hdlr → confirm video track
        const hdlr = findBox(buf, mdia + 8, mdiaEnd, "hdlr");
        if (hdlr >= 0 && hdlr + 16 <= len) {
          const h = String.fromCharCode(buf[hdlr + 12], buf[hdlr + 13], buf[hdlr + 14], buf[hdlr + 15]);
          if (h !== "vide") { trak += trakSz; continue; }
        }
        // mdhd: timescale
        const mdhd = findBox(buf, mdia + 8, mdiaEnd, "mdhd");
        if (mdhd >= 0 && mdhd + 28 <= len) {
          const ver = buf[mdhd + 8];
          const timescale = ver === 1 ? r32(buf, mdhd + 24) : r32(buf, mdhd + 16);
          // stts: sample delta → FPS
          const minf = findBox(buf, mdia + 8, mdiaEnd, "minf");
          if (minf >= 0) {
            const minfEnd = Math.min(minf + r32(buf, minf), mdiaEnd);
            const stbl = findBox(buf, minf + 8, minfEnd, "stbl");
            if (stbl >= 0) {
              const stblEnd = Math.min(stbl + r32(buf, stbl), minfEnd);
              const stts = findBox(buf, stbl + 8, stblEnd, "stts");
              if (stts >= 0 && stts + 20 <= len) {
                const entryCount = r32(buf, stts + 12);
                if (entryCount > 0 && stts + 20 <= len) {
                  const delta = r32(buf, stts + 20);
                  if (delta > 0 && timescale > 0) {
                    return Math.round((timescale / delta) * 100) / 100;
                  }
                }
              }
            }
          }
        }
      }
    }
    trak += trakSz;
  }
  return null;
}

// ── Main handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ ok: false, error: "URL diperlukan" }, { status: 400 });

  try {
    // 1. tikwm API — rich metadata (width/height/duration/size/play URL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tkData: any = null;
    try {
      const tkRes = await fetch(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&count=1&cursor=0&web=1&hd=1`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(8000),
        }
      );
      const tkJson = await tkRes.json();
      if (tkJson.code === 0 && tkJson.data) tkData = tkJson.data;
    } catch { /* fall through */ }

    // 2. oEmbed — always for title / author / thumbnail (official)
    const oembed = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      next: { revalidate: 60 },
    });
    if (!oembed.ok) throw new Error(`TikTok oEmbed error ${oembed.status}`);
    const oData = await oembed.json();

    // 3. Try to parse FPS from first 512 KB of video
    let fps: number | null = null;
    let bitrateKbps: number | null = null;
    const duration: number | null = tkData?.duration ?? null;
    const fileSize: number | null = tkData?.size ?? null;
    const videoUrl: string | null = tkData?.hdplay || tkData?.play || null;

    if (fileSize && duration && duration > 0) {
      bitrateKbps = Math.round((fileSize * 8) / (duration * 1000));
    }

    if (videoUrl) {
      try {
        const vRes = await fetch(videoUrl, {
          headers: {
            Range: "bytes=0-524287",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Referer: "https://www.tiktok.com/",
          },
          signal: AbortSignal.timeout(12000),
        });
        // Fallback bitrate from Content-Range if not from tikwm
        if (!bitrateKbps && duration) {
          const cr = vRes.headers.get("content-range");
          const m = cr?.match(/\/(\d+)/);
          if (m) bitrateKbps = Math.round((parseInt(m[1]) * 8) / (duration * 1000));
        }
        const buf = new Uint8Array(await vRes.arrayBuffer());
        fps = parseFPS(buf);
      } catch { /* keep null */ }
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...oData,
        width: tkData?.width || oData.width || null,
        height: tkData?.height || oData.height || null,
        duration,
        fps,
        bitrateKbps,
        fileSize,
        author_id: tkData?.author?.unique_id || null,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Gagal fetch" }, { status: 500 });
  }
}
