import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { readAccess } from "@/lib/access";
import { safeDocId } from "@/lib/rate-limit";
import { consumeQuota, peekQuota, refundQuota, type QuotaState } from "@/lib/quota";
import {
  startUserPostsRun,
  collectUserPostsRun,
  normalizeUsername,
  SourceError,
  type UserPostsPage,
} from "@/lib/tiktok-source";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DEVICE_COOKIE = "ul_device";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Tetap 30 video terbaru. Tidak ada "muat lagi": tiap kenaikan jatah video
 *  berarti run Apify baru, dan biayanya sulit diprediksi. */
const VIDEO_LIMIT = 30;

type Gate = { ok: false; res: NextResponse } | { ok: true; uid: string; isAdmin: boolean };

/** Sesi + akses produk + perangkat terdaftar. Dipakai POST maupun GET. */
async function gate(req: NextRequest): Promise<Gate> {
  const user = await getSessionUser(req);
  if (!user) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Silakan masuk dulu." }, { status: 401 }) };
  }

  const adminDb = await getAdminDb();
  const userRef = adminDb.collection("users").doc(user.uid);
  const deviceId = req.cookies.get(DEVICE_COOKIE)?.value;

  const [userSnap, deviceSnap] = await Promise.all([
    userRef.get(),
    deviceId && /^[0-9a-f-]{36}$/i.test(deviceId)
      ? userRef.collection("devices").doc(deviceId).get()
      : Promise.resolve(null),
  ]);

  if (!readAccess(userSnap.data()).analytics) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Akses TikTok Analytics belum aktif." }, { status: 403 }) };
  }
  if (!deviceSnap || !deviceSnap.exists) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Perangkat ini tidak terdaftar untuk akun tersebut." }, { status: 403 }) };
  }

  return { ok: true, uid: user.uid, isAdmin: user.isAdmin };
}

function cacheKey(username: string): string {
  return safeDocId(`${username.toLowerCase()}__${VIDEO_LIMIT}`);
}

async function readCache(key: string): Promise<UserPostsPage | null> {
  try {
    const adminDb = await getAdminDb();
    const snap = await adminDb.collection("analyticsCache").doc(key).get();
    const data = snap.data();
    if (!data || typeof data.cachedAt !== "number") return null;
    if (Date.now() - data.cachedAt > CACHE_TTL_MS) return null;
    return (data.payload as UserPostsPage) ?? null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, payload: UserPostsPage): Promise<void> {
  try {
    const adminDb = await getAdminDb();
    await adminDb.collection("analyticsCache").doc(key).set({ cachedAt: Date.now(), payload });
  } catch (e) {
    console.error("analytics cache write error:", e);
  }
}

function sourceFailure(e: unknown, quota?: QuotaState): NextResponse | null {
  if (!(e instanceof SourceError)) return null;
  const status =
    e.kind === "running" ? 202 : e.kind === "notfound" ? 404 : e.kind === "blocked" ? 429 : 502;
  const detail = process.env.NODE_ENV !== "production" ? e.detail : undefined;
  return NextResponse.json(
    {
      ok: e.kind === "running",
      done: false,
      error: e.kind === "running" ? undefined : e.message,
      detail,
      quota,
    },
    { status }
  );
}

/** Mulai pengambilan. Hasil dari cache dikembalikan langsung tanpa memotong jatah. */
export async function POST(req: NextRequest) {
  const g = await gate(req);
  if (!g.ok) return g.res;

  try {
    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(String(body?.username ?? ""));
    if (!username) {
      return NextResponse.json({ ok: false, error: "Username TikTok tidak valid." }, { status: 400 });
    }

    // Cache diperiksa SEBELUM jatah dipotong: tidak ada run Apify, tidak ada
    // biaya, jadi tidak ada alasan menagih jatah pelanggan.
    const key = cacheKey(username);
    const cached = await readCache(key);
    if (cached) {
      const quota = await peekQuota(g.uid, g.isAdmin);
      return NextResponse.json({ ok: true, done: true, data: cached, cached: true, quota });
    }

    const quota = await consumeQuota(g.uid, g.isAdmin);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Jatah ${quota.limit} analisis hari ini sudah terpakai. Jatah baru mulai tengah malam WIB.`,
          quota,
        },
        { status: 429 }
      );
    }

    let runId: string;
    try {
      runId = await startUserPostsRun(username, VIDEO_LIMIT);
    } catch (e) {
      // Run tidak pernah jalan, jadi tidak ada yang ditagih — jatahnya dibalikkan.
      await refundQuota(g.uid);
      const failure = sourceFailure(e, await peekQuota(g.uid, g.isAdmin));
      if (failure) return failure;
      throw e;
    }

    // Run dicatat milik siapa, supaya GET tidak bisa dipakai membaca run lain
    // di akun Apify yang sama hanya dengan menebak ID-nya.
    const adminDb = await getAdminDb();
    await adminDb.collection("analyticsRuns").doc(safeDocId(runId)).set({
      uid: g.uid,
      username,
      startedAt: Date.now(),
    });

    return NextResponse.json({ ok: true, done: false, runId, quota });
  } catch (e) {
    const failure = sourceFailure(e);
    if (failure) return failure;
    console.error("analytics POST error:", e);
    return NextResponse.json({ ok: false, error: "Gagal memulai pengambilan data." }, { status: 500 });
  }
}

/** Tanya hasil sebuah run. 202 berarti masih berjalan — tanya lagi sebentar lagi.
 *  Polling TIDAK memotong jatah; yang dihitung cuma run yang dimulai. */
export async function GET(req: NextRequest) {
  const g = await gate(req);
  if (!g.ok) return g.res;

  try {
    const runId = new URL(req.url).searchParams.get("runId") ?? "";
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(runId)) {
      return NextResponse.json({ ok: false, error: "runId tidak valid." }, { status: 400 });
    }

    const adminDb = await getAdminDb();
    const runSnap = await adminDb.collection("analyticsRuns").doc(safeDocId(runId)).get();
    const run = runSnap.data();

    if (!run || run.uid !== g.uid) {
      return NextResponse.json({ ok: false, error: "Run tidak ditemukan." }, { status: 404 });
    }

    const page = await collectUserPostsRun(runId, VIDEO_LIMIT);
    if (page.videos.length > 0) void writeCache(cacheKey(String(run.username)), page);

    return NextResponse.json({ ok: true, done: true, data: page });
  } catch (e) {
    const failure = sourceFailure(e);
    if (failure) return failure;
    console.error("analytics GET error:", e);
    return NextResponse.json({ ok: false, error: "Gagal mengambil hasil." }, { status: 500 });
  }
}
