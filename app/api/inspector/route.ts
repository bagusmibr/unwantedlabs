import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const UA_MOBILE = "okhttp/3.14.9";

// ── ISO 14496-12 MP4 box parser ────────────────────────────────────────────
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
    i += sz;  // allow box to extend beyond end (sliced buffers)
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

        // hdlr: handler_type at offset +16 (size4 + type4 + ver1 + flags3 + pre_defined4)
        const hdlr = findBox(buf, mdia + 8, mdiaEnd, "hdlr");
        if (hdlr >= 0 && hdlr + 20 <= len) {
          const handler = String.fromCharCode(buf[hdlr + 16], buf[hdlr + 17], buf[hdlr + 18], buf[hdlr + 19]);
          if (handler !== "vide") { trak += trakSz; continue; }
        }

        // mdhd: timescale at +20 (v0) or +28 (v1)
        const mdhd = findBox(buf, mdia + 8, mdiaEnd, "mdhd");
        if (mdhd >= 0 && mdhd + 28 <= len) {
          const ver = buf[mdhd + 8];
          const timescale = ver === 1 ? r32(buf, mdhd + 28) : r32(buf, mdhd + 20);
          if (timescale > 0) {
            // stts inside stbl inside minf
            const minf = findBox(buf, mdia + 8, mdiaEnd, "minf");
            if (minf >= 0) {
              const minfEnd = Math.min(minf + r32(buf, minf), mdiaEnd);
              const stbl = findBox(buf, minf + 8, minfEnd, "stbl");
              if (stbl >= 0) {
                const stblEnd = Math.min(stbl + r32(buf, stbl), len);
                const stts = findBox(buf, stbl + 8, stblEnd, "stts");
                if (stts >= 0 && stts + 24 <= len) {
                  const entryCount = r32(buf, stts + 12);
                  if (entryCount > 0) {
                    const delta = r32(buf, stts + 20);
                    if (delta > 0) {
                      return Math.round((timescale / delta) * 1000) / 1000;
                    }
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

// ── Stream-limited fetch (reads at most maxBytes to avoid OOM) ─────────────
async function fetchPartial(url: string, maxBytes = 2097152, extraHeaders: Record<string,string> = {}): Promise<Uint8Array | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      headers: { "User-Agent": UA_MOBILE, Referer: "https://www.tiktok.com/", ...extraHeaders },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!res.ok && res.status !== 206) { clearTimeout(timer); return null; }
    if (!res.body) { clearTimeout(timer); return null; }

    // Stream-read up to maxBytes
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

    // Merge chunks
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  } catch { return null; }
}

// ── FPS detector: tries multiple URL strategies ────────────────────────────
async function detectFPS(videoId: string, candidates: Array<{url: string; size?: number}>): Promise<number | null> {
  // Strategy 1: tikcdn.io — predictable URL from videoId, no auth, faststart MP4
  if (videoId) {
    const tikcdnUrl = `https://tikcdn.io/ssstik/${videoId}`;
    const buf = await fetchPartial(tikcdnUrl, 2097152);
    if (buf) {
      const fps = parseFPS(buf);
      if (fps !== null) return fps;
    }
  }

  // Strategy 2: authenticated CDN/API URLs from scraper (Range request)
  for (const { url, size } of candidates) {
    if (!url) continue;
    // Try Range on first 2MB
    const buf1 = await fetchPartial(url, 2097152, { Range: "bytes=0-2097151" });
    if (buf1) {
      const fps = parseFPS(buf1);
      if (fps !== null) return fps;
    }
    // Try Range on last 2MB (moov at end for non-faststart files)
    if (size && size > 2097152) {
      const start = size - 2097152;
      const buf2 = await fetchPartial(url, 2097152, { Range: `bytes=${start}-${size - 1}` });
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
    // ── Run ALL data sources + FPS in parallel ─────────────────────────
    const [scraperRes, tikwmRes, oembedRes, fpsResult] = await Promise.allSettled([
      // 1. tiktok-video-scraper — stats, author, duration, video URLs
      (async () => {
        const { default: Tiktok } = await import("tiktok-video-scraper");
        const result = await Tiktok(url);
        return Array.isArray(result) ? result[0] : result;
      })(),
      // 2. tikwm — engagement + video URL fallback
      fetch(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&count=1&cursor=0&web=1&hd=1`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) }
      ).then(r => r.json()),
      // 3. oEmbed — official title, thumbnail, author
      fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }, next: { revalidate: 60 } }
      ).then(r => { if (!r.ok) throw new Error(`oEmbed ${r.status}`); return r.json(); }),
      // 4. FPS detection — starts immediately with videoId (tikcdn.io), no auth needed
      videoId ? detectFPS(videoId, []) : Promise.resolve(null),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawVid: any = scraperRes.status === "fulfilled" ? scraperRes.value : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tkRaw:  any = tikwmRes.status  === "fulfilled" ? tikwmRes.value  : null;
    const tkData = tkRaw?.code === 0 && tkRaw?.data ? tkRaw.data : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oData:  any = oembedRes.status === "fulfilled" ? oembedRes.value : null;

    // Already have initial FPS from parallel tikcdn.io fetch
    let fps: number | null = fpsResult.status === "fulfilled" ? fpsResult.value : null;

    // If tikcdn.io failed, retry with scraper/tikwm URLs
    if (fps === null && rawVid) {
      const br = rawVid?.video?.bit_rate?.[0];
      const tiktokApiUrl = br?.play_addr?.url_list?.find((u: string) => u.includes("api.tiktokv.com")) ?? null;
      const fallbackCandidates: Array<{url: string; size?: number}> = [];
      if (tiktokApiUrl) fallbackCandidates.push({ url: tiktokApiUrl, size: br?.play_addr?.data_size });
      if (tkData?.hdplay) fallbackCandidates.push({ url: tkData.hdplay, size: tkData.hd_size });
      if (tkData?.play)   fallbackCandidates.push({ url: tkData.play,   size: tkData.size });
      if (fallbackCandidates.length > 0) {
        fps = await detectFPS("", fallbackCandidates); // skip tikcdn.io (already tried)
      }
    }

    if (!oData && !rawVid && !tkData) {
      throw new Error("Gagal mengambil data dari semua sumber.");
    }

    // ── Extract metadata ───────────────────────────────────────────────
    const video  = rawVid?.video;
    const stats  = rawVid?.statistics ?? {};
    const author = rawVid?.author ?? {};
    const br     = video?.bit_rate?.[0];

    const width:  number | null = video?.width  || (tkData?.width  > 0 ? tkData.width  : null);
    const height: number | null = video?.height || (tkData?.height > 0 ? tkData.height : null);
    const durationMs = video?.duration || null;
    const duration: number | null = durationMs ? Math.round(durationMs / 1000) : (tkData?.duration ?? null);
    const region:      string | null = rawVid?.region       || null;
    const createTime:  number | null = rawVid?.create_time  || null;
    const desc:        string | null = rawVid?.desc         || null;
    const ratio:       string | null = video?.ratio         || null;
    const codecType:   string | null = video?.is_bytevc1 === 1 ? "h265" : (br ? "h264" : null);

    // Dual audio track = TikTok 120fps processing tier ("Dapur Kita" trick)
    // bit_rate_audio is non-null ONLY when a second audio track exists
    const hasDualAudio: boolean = !!(video?.bit_rate_audio);
    const tiktokTier: number | null = hasDualAudio ? 120 : null;

    const fileSize: number | null = br?.play_addr?.data_size || tkData?.hd_size || tkData?.size || null;
    let bitrateKbps: number | null = br?.bit_rate ? Math.round(br.bit_rate / 1000) : null;
    if (!bitrateKbps && fileSize && duration && duration > 0) {
      bitrateKbps = Math.round((fileSize * 8) / (duration * 1000));
    }

    // ── Streaming quality ──────────────────────────────────────────────
    let browserQ = ratio, phoneQ = ratio;
    if (!browserQ && height) {
      if      (height >= 1920) { browserQ = "1080p"; phoneQ = "720p"; }
      else if (height >= 1080) { browserQ = "720p";  phoneQ = "540p"; }
      else if (height >= 720)  { browserQ = "540p";  phoneQ = "360p"; }
      else                     { browserQ = "360p";  phoneQ = "360p"; }
    }

    // ── Engagement ─────────────────────────────────────────────────────
    const views     = stats.play_count    ?? tkData?.play_count    ?? null;
    const likes     = stats.digg_count    ?? tkData?.digg_count    ?? null;
    const comments  = stats.comment_count ?? tkData?.comment_count ?? null;
    const shares    = stats.share_count   ?? tkData?.share_count   ?? null;
    const favorites = stats.collect_count ?? tkData?.collect_count ?? null;
    const downloads = stats.download_count ?? null;
    let engagementRate: number | null = null;
    if (views && views > 0 && likes !== null) {
      const interactions = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (favorites ?? 0);
      engagementRate = Math.round((interactions / views) * 10000) / 100;
    }

    return NextResponse.json({
      ok: true,
      data: {
        title:            desc             || oData?.title         || null,
        author_name:      author.nickname  || oData?.author_name   || null,
        author_url:       oData?.author_url || null,
        author_id:        author.unique_id  || oData?.author_id    || null,
        author_avatar:    author.avatar_medium?.url_list?.[0]      || null,
        thumbnail_url:    oData?.thumbnail_url                     || null,
        thumbnail_width:  oData?.thumbnail_width                   || null,
        thumbnail_height: oData?.thumbnail_height                  || null,
        provider_name: "TikTok",
        // Video specs
        width, height, duration,
        fps,          // physical FPS from MP4 stts
        tiktokTier,   // TikTok processing tier (120 if dual audio track detected)
        hasDualAudio, // true = video has the 120fps dual-audio trick
        bitrateKbps, fileSize, codecType,
        definition: ratio,
        region, createTime, videoId,
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
