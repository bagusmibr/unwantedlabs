import { NextRequest, NextResponse } from "next/server";

const UA        = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const UA_MOBILE = "okhttp/3.14.9";

// ── ISO 14496-12 MP4 box parser ────────────────────────────────────────────
function r32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function btype(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
}
// findBox: scan boxes at one level; does NOT break on large boxes (may extend past slice)
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
        // hdlr handler_type at offset +16 (size4+type4+ver1+flags3+pre_defined4)
        const hdlr = findBox(buf, mdia + 8, mdiaEnd, "hdlr");
        if (hdlr >= 0 && hdlr + 20 <= len) {
          const h = String.fromCharCode(buf[hdlr+16], buf[hdlr+17], buf[hdlr+18], buf[hdlr+19]);
          if (h !== "vide") { trak += trakSz; continue; }
        }
        // mdhd timescale: v0@+20, v1@+28
        const mdhd = findBox(buf, mdia + 8, mdiaEnd, "mdhd");
        if (mdhd >= 0 && mdhd + 28 <= len) {
          const ver = buf[mdhd + 8];
          const ts  = ver === 1 ? r32(buf, mdhd + 28) : r32(buf, mdhd + 20);
          if (ts > 0) {
            const minf = findBox(buf, mdia + 8, mdiaEnd, "minf");
            if (minf >= 0) {
              const minfEnd = Math.min(minf + r32(buf, minf), mdiaEnd);
              const stbl = findBox(buf, minf + 8, minfEnd, "stbl");
              if (stbl >= 0) {
                const stblEnd = Math.min(stbl + r32(buf, stbl), len);
                const stts = findBox(buf, stbl + 8, stblEnd, "stts");
                if (stts >= 0 && stts + 24 <= len) {
                  const count = r32(buf, stts + 12);
                  if (count > 0) {
                    const delta = r32(buf, stts + 20);
                    if (delta > 0) return Math.round((ts / delta) * 1000) / 1000;
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

// ── Stream-limited fetch: read at most maxBytes to avoid OOM ───────────────
async function fetchPartial(
  url: string,
  maxBytes = 2097152,
  extraHeaders: Record<string, string> = {}
): Promise<Uint8Array | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA_MOBILE, Referer: "https://www.tiktok.com/", ...extraHeaders },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok && res.status !== 206) { clearTimeout(timer); return null; }
    if (!res.body) { clearTimeout(timer); return null; }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (total < maxBytes) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.length;
      }
    } finally {
      reader.cancel();
      clearTimeout(timer);
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  } catch { return null; }
}

// ── Detect FPS from a direct TikTok CDN/API URL ────────────────────────────
// Uses Range requests on the REAL TikTok CDN (not third-party proxies).
// tikcdn.io/ssstik re-encodes videos and returns wrong fps — do NOT use it.
async function detectFPS(
  candidates: Array<{ url: string; size?: number }>
): Promise<number | null> {
  for (const { url, size } of candidates) {
    if (!url) continue;
    // First 2MB: TikTok videos use faststart (moov at beginning)
    const buf1 = await fetchPartial(url, 2097152, { Range: "bytes=0-2097151" });
    if (buf1) {
      const fps = parseFPS(buf1);
      if (fps !== null) return fps;
    }
    // Last 2MB fallback: for non-faststart files
    if (size && size > 2097152) {
      const buf2 = await fetchPartial(url, 2097152, { Range: `bytes=${size - 2097152}-${size - 1}` });
      if (buf2) {
        const fps = parseFPS(buf2);
        if (fps !== null) return fps;
      }
    }
  }
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
    // ── Phase 1: run ALL metadata sources in parallel ─────────────────────
    const scraperPromise = (async () => {
      const { default: Tiktok } = await import("tiktok-video-scraper");
      const result = await Tiktok(url);
      return Array.isArray(result) ? result[0] : result;
    })();

    const tikwmPromise = fetch(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&count=1&cursor=0&web=1&hd=1`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) }
    ).then(r => r.json()).catch(() => null);

    const oembedPromise = fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }, next: { revalidate: 60 } }
    ).then(r => { if (!r.ok) throw new Error(`oEmbed ${r.status}`); return r.json(); }).catch(() => null);

    // ── Phase 2: FPS detection CHAINED to scraper (uses REAL TikTok CDN URL)
    // Critical: tikcdn.io and similar proxies re-encode videos → wrong fps!
    // We must use the authenticated api.tiktokv.com or v16m CDN URL from scraper.
    const fpsPromise = scraperPromise.then(async (rawVid) => {
      if (!rawVid?.video?.bit_rate?.length) return null;
      // Collect ALL bit_rate entries and find the best play URLs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidates: Array<{ url: string; size?: number }> = rawVid.video.bit_rate.flatMap((br: any) => {
        const urls: string[] = br?.play_addr?.url_list ?? [];
        const size: number | undefined = br?.play_addr?.data_size;
        return urls
          .filter((u: string) => u.includes("api.tiktokv.com") || u.includes("tiktokcdn.com") || u.includes("byteicdn.com"))
          .map((u: string) => ({ url: u, size }));
      });
      return candidates.length > 0 ? detectFPS(candidates) : null;
    }).catch(() => null);

    // ── Wait for everything ───────────────────────────────────────────────
    const [rawVidRes, tkRawRes, oDataRes, fps] = await Promise.all([
      scraperPromise.catch(() => null),
      tikwmPromise,
      oembedPromise,
      fpsPromise,
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawVid: any = rawVidRes;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tkData: any = tkRawRes?.code === 0 && tkRawRes?.data ? tkRawRes.data : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oData: any = oDataRes;

    if (!oData && !rawVid && !tkData) {
      throw new Error("Gagal mengambil data dari semua sumber.");
    }

    // ── Extract metadata ───────────────────────────────────────────────────
    const video  = rawVid?.video;
    const stats  = rawVid?.statistics ?? {};
    const author = rawVid?.author ?? {};
    const br     = video?.bit_rate?.[0];

    const width:       number | null = video?.width  || (tkData?.width  > 0 ? tkData.width  : null);
    const height:      number | null = video?.height || (tkData?.height > 0 ? tkData.height : null);
    const durationMs                 = video?.duration || null;
    const duration:    number | null = durationMs ? Math.round(durationMs / 1000) : (tkData?.duration ?? null);
    const region:      string | null = rawVid?.region      || null;
    const createTime:  number | null = rawVid?.create_time || null;
    const desc:        string | null = rawVid?.desc        || null;
    const ratio:       string | null = video?.ratio        || null;
    const codecType:   string | null = video?.is_bytevc1 === 1 ? "h265" : (br ? "h264" : null);

    // Dual audio = 120fps TikTok processing tier ("Dapur Kita" trick)
    const hasDualAudio: boolean      = !!(video?.bit_rate_audio);
    const tiktokTier:   number | null = hasDualAudio ? 120 : null;

    const fileSize:    number | null = br?.play_addr?.data_size || tkData?.hd_size || tkData?.size || null;
    let bitrateKbps:   number | null = br?.bit_rate ? Math.round(br.bit_rate / 1000) : null;
    if (!bitrateKbps && fileSize && duration && duration > 0) {
      bitrateKbps = Math.round((fileSize * 8) / (duration * 1000));
    }

    // ── Streaming quality ──────────────────────────────────────────────────
    let browserQ = ratio, phoneQ = ratio;
    if (!browserQ && height) {
      if      (height >= 1920) { browserQ = "1080p"; phoneQ = "720p"; }
      else if (height >= 1080) { browserQ = "720p";  phoneQ = "540p"; }
      else if (height >= 720)  { browserQ = "540p";  phoneQ = "360p"; }
      else                     { browserQ = "360p";  phoneQ = "360p"; }
    }

    // ── Engagement ─────────────────────────────────────────────────────────
    const views     = stats.play_count    ?? tkData?.play_count    ?? null;
    const likes     = stats.digg_count    ?? tkData?.digg_count    ?? null;
    const comments  = stats.comment_count ?? tkData?.comment_count ?? null;
    const shares    = stats.share_count   ?? tkData?.share_count   ?? null;
    const favorites = stats.collect_count ?? tkData?.collect_count ?? null;
    const downloads = stats.download_count ?? null;

    // ER is only valid when: views > 0 AND at least one interaction metric exists
    const hasInteractions = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (favorites ?? 0) > 0;
    const erValid = !!(views && views > 0 && hasInteractions);

    let engagementRate: number | null = null;
    let erBreakdown: { likesRate: number; commentsRate: number; sharesRate: number; favoritesRate: number; downloadsRate: number } | null = null;

    if (erValid && views) {
      const pct = (n: number | null) => Math.round(((n ?? 0) / views!) * 10000) / 100;
      const likesRate     = pct(likes);
      const commentsRate  = pct(comments);
      const sharesRate    = pct(shares);
      const favoritesRate = pct(favorites);
      const downloadsRate = pct(downloads);
      engagementRate = Math.round((likesRate + commentsRate + sharesRate + favoritesRate) * 100) / 100;
      erBreakdown = { likesRate, commentsRate, sharesRate, favoritesRate, downloadsRate };
    }

    return NextResponse.json({
      ok: true,
      data: {
        title:            desc             || oData?.title          || null,
        author_name:      author.nickname  || oData?.author_name    || null,
        author_url:       oData?.author_url || null,
        author_id:        author.unique_id  || oData?.author_id     || null,
        author_avatar:    author.avatar_medium?.url_list?.[0]       || null,
        thumbnail_url:    oData?.thumbnail_url                      || null,
        thumbnail_width:  oData?.thumbnail_width                    || null,
        thumbnail_height: oData?.thumbnail_height                   || null,
        provider_name: "TikTok",
        // Video specs — fps from REAL TikTok CDN (not re-encoding proxies)
        width, height, duration,
        fps,           // physical FPS parsed from TikTok CDN MP4 stts
        tiktokTier,    // 120 if dual audio track (Dapur Kita trick) detected
        hasDualAudio,  // true = second audio track present
        bitrateKbps, fileSize, codecType,
        definition: ratio,
        region, createTime, videoId,
        embedUrl: videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : null,
        // Streaming quality
        browserQ, phoneQ,
        // Engagement
        views, likes, comments, favorites, shares, downloads,
        engagementRate, erBreakdown,  // erBreakdown is null when not valid
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Gagal fetch" }, { status: 500 });
  }
}
