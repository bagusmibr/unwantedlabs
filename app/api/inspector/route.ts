import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Extract from TikTok page SIGI_STATE ────────────────────────────────────
async function fetchFromTikTokPage(url: string, videoId: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Try SIGI_STATE (newer TikTok pages)
    const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
    if (sigiMatch) {
      const sigi = JSON.parse(sigiMatch[1]);
      const vid = sigi?.ItemModule?.[videoId]?.video;
      if (vid) {
        return {
          fps: vid.fps || vid.frameRate || null,
          width: vid.width || null,
          height: vid.height || null,
          bitrateKbps: vid.bitrate ? Math.round(vid.bitrate / 1000) : null,
          codecType: vid.codecType || null,
          definition: vid.definition || null,
        };
      }
    }

    // Try __NEXT_DATA__ (older TikTok pages)
    const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      const next = JSON.parse(nextMatch[1]);
      const items = next?.props?.pageProps?.itemInfo?.itemStruct?.video;
      if (items) {
        return {
          fps: items.fps || items.frameRate || null,
          width: items.width || null,
          height: items.height || null,
          bitrateKbps: items.bitrate ? Math.round(items.bitrate / 1000) : null,
          codecType: items.codecType || null,
          definition: items.definition || null,
        };
      }
    }

    // Try inline JSON __UNIVERSAL_DATA_FOR_REHYDRATION__
    const universalMatch = html.match(/window\["__UNIVERSAL_DATA_FOR_REHYDRATION__"\]\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/);
    if (universalMatch) {
      const u = JSON.parse(universalMatch[1]);
      const detail = u?.["__DEFAULT_SCOPE__"]?.["webapp.video-detail"]?.itemInfo?.itemStruct?.video;
      if (detail) {
        return {
          fps: detail.fps || detail.frameRate || null,
          width: detail.width || null,
          height: detail.height || null,
          bitrateKbps: detail.bitrate ? Math.round(detail.bitrate / 1000) : null,
          codecType: detail.codecType || null,
          definition: detail.definition || null,
        };
      }
    }

    return null;
  } catch { return null; }
}

// ── Main handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ ok: false, error: "URL diperlukan" }, { status: 400 });

  const videoIdMatch = url.match(/video\/(\d+)/);
  const videoId = videoIdMatch?.[1] ?? null;

  try {
    // 1. tikwm API — rich metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tkData: any = null;
    try {
      const tkRes = await fetch(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&count=1&cursor=0&web=1&hd=1`,
        {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(8000),
        }
      );
      const tkJson = await tkRes.json();
      if (tkJson.code === 0 && tkJson.data) tkData = tkJson.data;
    } catch { /* fall through */ }

    // 2. oEmbed — title / author / thumbnail (official fallback)
    const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      next: { revalidate: 60 },
    });
    if (!oembedRes.ok) throw new Error(`TikTok oEmbed error ${oembedRes.status}`);
    const oData = await oembedRes.json();

    // 3. Parse TikTok page for fps/bitrate/codec
    let pageData: {
      fps: number | null; width: number | null; height: number | null;
      bitrateKbps: number | null; codecType: string | null; definition: string | null;
    } | null = null;

    if (videoId) {
      // Try the original URL first, then a canonical form
      pageData = await fetchFromTikTokPage(url, videoId);
      if (!pageData && tkData?.author?.unique_id) {
        const canonicalUrl = `https://www.tiktok.com/@${tkData.author.unique_id}/video/${videoId}`;
        pageData = await fetchFromTikTokPage(canonicalUrl, videoId);
      }
    }

    // 4. Assemble final data
    const duration: number | null = tkData?.duration ?? null;
    const fileSize: number | null = tkData?.size ?? tkData?.hd_size ?? null;

    let bitrateKbps: number | null = pageData?.bitrateKbps ?? null;
    // Fallback: calculate from file size + duration
    if (!bitrateKbps && fileSize && duration && duration > 0) {
      bitrateKbps = Math.round((fileSize * 8) / (duration * 1000));
    }

    const fps: number | null = pageData?.fps ?? null;
    const width: number | null = pageData?.width ?? tkData?.width ?? oData.width ?? null;
    const height: number | null = pageData?.height ?? tkData?.height ?? oData.height ?? null;

    return NextResponse.json({
      ok: true,
      data: {
        ...oData,
        width,
        height,
        duration,
        fps,
        bitrateKbps,
        fileSize,
        codecType: pageData?.codecType ?? null,
        definition: pageData?.definition ?? null,
        author_id: tkData?.author?.unique_id ?? null,
        videoId,
        embedUrl: videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : null,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Gagal fetch" }, { status: 500 });
  }
}
