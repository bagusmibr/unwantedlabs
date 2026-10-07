// Hanya untuk route handler / server component — mengimpor firebase-admin.
import { getAdminDb } from "@/lib/firebase-admin";
import {
  isEngineState,
  readEngineStatus,
  MESSAGE_MAX,
  type EngineStatus,
  type EngineStatusLogEntry,
} from "@/lib/engine-status";

const DOC = ["config", "engineStatus"] as const;
const LOG = "engineStatusLog";

/** Halaman publik dibuka jauh lebih sering daripada status berubah. Cache
 *  singkat per instance memangkas bacaan Firestore tanpa membuat perubahan
 *  admin terasa lambat. Gerbang engine TIDAK memakai cache ini. */
const MEMO_MS = 10_000;
let memo: { at: number; value: EngineStatus } | null = null;

export async function getEngineStatus(opts: { fresh?: boolean } = {}): Promise<EngineStatus> {
  if (!opts.fresh && memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  const db = await getAdminDb();
  const snap = await db.collection(DOC[0]).doc(DOC[1]).get();
  const value = readEngineStatus(snap.exists ? snap.data() : null);
  memo = { at: Date.now(), value };
  return value;
}

export async function getEngineStatusHistory(
  limit = 20,
  opts: { includeBy?: boolean } = {},
): Promise<EngineStatusLogEntry[]> {
  const db = await getAdminDb();
  const snap = await db.collection(LOG).orderBy("updatedAt", "desc").limit(limit).get();
  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      ...readEngineStatus(raw),
      ...(opts.includeBy ? { by: String(raw.updatedBy ?? "") } : {}),
    };
  });
}

/** Validasi + simpan + catat riwayat. Melempar Error bila input tidak sah. */
export async function setEngineStatus(body: unknown, by: string): Promise<EngineStatus> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isEngineState(b.state)) throw new Error("Status tidak dikenal.");

  let eta: Date | null = null;
  if (b.eta != null && b.eta !== "") {
    const t = typeof b.eta === "number" ? b.eta : Date.parse(String(b.eta));
    if (!Number.isFinite(t)) throw new Error("Format ETA tidak sah.");
    eta = new Date(t);
  }

  const record = {
    state: b.state,
    message: String(b.message ?? "").trim().slice(0, MESSAGE_MAX),
    blockEngine: b.blockEngine === true,
    // ETA hanya relevan selama engine tidak normal.
    eta: b.state === "online" ? null : eta,
    updatedAt: new Date(),
    updatedBy: by,
  };

  const db = await getAdminDb();
  const batch = db.batch();
  batch.set(db.collection(DOC[0]).doc(DOC[1]), record);
  batch.set(db.collection(LOG).doc(), record);
  await batch.commit();

  const value = readEngineStatus(record);
  memo = { at: Date.now(), value };
  return value;
}
