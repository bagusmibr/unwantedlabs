import { NextRequest, NextResponse } from "next/server";

// ── MP4 FPS parser (corrected ISO 14496-12 offsets) ───────────────────────
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
    if (sz < 8 || sz > end - i) break;
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

        // hdlr: handler_type is at box_start + 16 (after size4 + type4 + version1 + flags3 + pre_defined4)
        const hdlr = findBox(buf, mdia + 8, mdiaEnd, "hdlr");
        if (hdlr >= 0 && hdlr + 20 <= len) {
          const handler = String.fromCharCode(buf[hdlr + 16], buf[hdlr + 17], buf[hdlr + 18], buf[hdlr + 19]);
          if (handler !== "vide") { trak += trakSz; continue; }
        }

        // mdhd v0: timescale at +20, duration at +24
        // mdhd v1: timescale at +28, duration at +32 (8 bytes)
        const mdhd = findBox(buf, mdia + 8, mdiaEnd, "mdhd");
        if (mdhd >= 0 && mdhd + 28 <= len) {
          const ver = buf[mdhd + 8];
          const timescale = ver === 1 ? r32(buf, mdhd + 28) : r32(buf, mdhd + 20);

          // stts: entry_count at +12, first [sample_count, sample_delta] at +16/+20
          const minf = findBox(buf, mdia + 8, mdiaEnd, "minf");
          if (minf >= 0) {
            const minfEnd = Math.min(minf + r32(buf, minf), mdiaEnd);
            const stbl = findBox(buf, minf + 8, minfEnd, "stbl");
            if (stbl >= 0) {
              const stblEnd = Math.min(stbl + r32(buf, stbl), minfEnd);
              const stts = findBox(buf, stbl + 8, stblEnd, "stts");
              if (stts >= 0 && stts + 24 <= len) {
                const entryCount = r32(buf, stts + 12);
                if (entryCount > 0) {
                  const delta = r32(buf, stts + 20);
                  if (delta > 0 && timescale > 0) {
                    return Math.round((timescale / delta) * 1000) / 1000;
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

// ── FPS via Range request using tiktokv.com API URL ───────────────────────
async function fetchFPSFromUrl(playUrl: string, dataSize: number): Promise<number | null> {
  try {
    const start = Math.max(0, dataSize - 2097152);
    // Try last 2MB first (moov often at end for streaming)
    let res = await fetch(playUrl, {
      headers: { Range: `bytes=${start}-${dataSize - 1}`, "User-Agent": "okhttp/3.14.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok || res.status === 206) {
      const fps = parseFPS(new Uint8Array(await res.arrayBuffer()));
      if (fps) return fps;
    }
    // Fallback: first 1MB
    res = await fetch(playUrl, {
      headers: { Range: "bytes=0-1048575", "User-Agent": "okhttp/3.14.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok || res.status === 206) {
      return parseFPS(new Uint8Array(await res.arrayBuffer()));
    }
  } catch { /* ignore */ }
  return null;
}

// ── Main handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ ok: false, error: "URL diperlukan" }, { status: 400 });

  const videoIdMatch = url.match(/video\/(\d+)/);
  const videoId = videoIdMatch?.[1] ?? null;

  try {
    // ── Step 1: tiktok-video-scraper (TikTok mobile API) ─────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawVid: any = null;
    try {
      const { default: Tiktok } = await import("tiktok-video-scraper");
      const result = await Tiktok(url);
      rawVid = Array.isArray(result) ? result[0] : result;
    } catch { /* fall through */ }

    // ── Step 2: oEmbed for thumbnail / title fallback ─────────────────────
    const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      next: { revalidate: 60 },
    });
    if (!oembedRes.ok) throw new Error(`TikTok oEmbed error ${oembedRes.status}`);
    const oData = await oembedRes.json();

    // ── Step 3: Extract fields from raw scraper data ──────────────────────
    const video = rawVid?.video;
    const stats = rawVid?.statistics ?? {};
    const author = rawVid?.author ?? {};

    const width: number | null = video?.width || null;
    const height: number | null = video?.height || null;
    const durationMs: number | null = video?.duration || null;
    const duration: number | null = durationMs ? Math.round(durationMs / 1000) : null;
    const ratio: string | null = video?.ratio || null; // e.g. "540p"
    const createTime: number | null = rawVid?.create_time || null;
    const region: string | null = rawVid?.region || null;
    const desc: string | null = rawVid?.desc || null;

    // bitrate and file size from bit_rate array
    const br = video?.bit_rate?.[0];
    const bitrateKbps: number | null = br?.bit_rate ? Math.round(br.bit_rate / 1000) : null;
    const fileSize: number | null = br?.play_addr?.data_size || null;
    const codecType: string | null = (video?.is_bytevc1 === 1) ? "h265" : (br ? "h264" : null);

    // ── Step 4: FPS via Range request on tiktokv.com URL ─────────────────
    let fps: number | null = null;
    const playUrl = br?.play_addr?.url_list?.find((u: string) => u.includes("api.tiktokv.com")) || null;
    if (playUrl && fileSize) {
      fps = await fetchFPSFromUrl(playUrl, fileSize);
    }

    // ── Step 5: Streaming quality estimate ────────────────────────────────
    let browserQ: string | null = ratio || null;
    let phoneQ: string | null = ratio || null;
    if (!browserQ && height) {
      if (height >= 1920) { browserQ = "1080p"; phoneQ = "720p"; }
      else if (height >= 1080) { browserQ = "720p"; phoneQ = "540p"; }
      else if (height >= 720) { browserQ = "540p"; phoneQ = "360p"; }
      else { browserQ = "360p"; phoneQ = "360p"; }
    }

    // ── Step 6: Engagement ────────────────────────────────────────────────
    const views: number | null = stats.play_count ?? null;
    const likes: number | null = stats.digg_count ?? null;
    const comments: number | null = stats.comment_count ?? null;
    const shares: number | null = stats.share_count ?? null;
    const favorites: number | null = stats.collect_count ?? null;
    const downloads: number | null = stats.download_count ?? null;
    let engagementRate: number | null = null;
    if (views && views > 0 && likes !== null) {
      const interactions = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (favorites ?? 0);
      engagementRate = Math.round((interactions / views) * 10000) / 100;
    }

    return NextResponse.json({
      ok: true,
      data: {
        // From oEmbed (title/thumbnail/author fallback)
        title: desc || oData.title,
        author_name: author.nickname || oData.author_name,
        author_url: oData.author_url,
        author_id: author.unique_id || oData.author_id || null,
        author_avatar: author.avatar_medium?.url_list?.[0] || null,
        thumbnail_url: oData.thumbnail_url,
        thumbnail_width: oData.thumbnail_width,
        thumbnail_height: oData.thumbnail_height,
        provider_name: "TikTok",
        // Video specs
        width, height, duration, fps,
        bitrateKbps, fileSize, codecType,
        definition: ratio,
        region, createTime,
        videoId,
        embedUrl: videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : null,
        // Streaming quality
        browserQ, phoneQ,
        // Engagement
        views, likes, comments, favorites, shares, downloads, engagementRate,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Gagal fetch" }, { status: 500 });
  }
}
