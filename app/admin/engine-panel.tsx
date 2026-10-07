"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EngineStatusBanner, EngineStatusPill, StatusDot } from "@/components/EngineStatus";
import {
  ENGINE_STATES,
  MESSAGE_MAX,
  STATE_META,
  fmtDateTime,
  readEngineStatus,
  statusMessage,
  timeAgo,
  type EngineState,
  type EngineStatus,
  type EngineStatusLogEntry,
} from "@/lib/engine-status";
import styles from "./engine-panel.module.css";

interface Draft {
  state: EngineState;
  message: string;
  blockEngine: boolean;
  /** Nilai <input type="datetime-local">, waktu lokal. "" = tanpa ETA. */
  eta: string;
}

function toLocalInput(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime(); // datetime-local tanpa zona = waktu lokal browser
  return Number.isFinite(t) ? t : null;
}
function draftOf(s: EngineStatus): Draft {
  return { state: s.state, message: s.message, blockEngine: s.blockEngine, eta: toLocalInput(s.eta) };
}

export default function EnginePanel({
  onToast,
  onStatus,
}: {
  onToast: (msg: string, type: "success" | "error") => void;
  onStatus: (s: EngineStatus) => void;
}) {
  const [current, setCurrent] = useState<EngineStatus | null>(null);
  const [history, setHistory] = useState<EngineStatusLogEntry[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/admin/engine-status").then((r) => r.json());
      if (!d?.ok) throw new Error();
      const s = readEngineStatus(d.data);
      setCurrent(s);
      setDraft(draftOf(s));
      setHistory((d.history ?? []).map((h: { id: string; by?: string }) => ({ id: h.id, by: h.by, ...readEngineStatus(h) })));
      setLoadError(false);
      onStatus(s);
    } catch {
      setLoadError(true);
    }
  }, [onStatus]);

  useEffect(() => { void (async () => { await load(); })(); }, [load]);

  /** Status seperti yang akan dilihat pelanggan bila draf disimpan. */
  const preview: EngineStatus | null = useMemo(() => draft && {
    state: draft.state,
    message: draft.message,
    blockEngine: draft.blockEngine,
    eta: draft.state === "online" ? null : fromLocalInput(draft.eta),
    // Belum disimpan, jadi belum punya waktu — banner menyembunyikan jamnya.
    updatedAt: null,
  }, [draft]);

  const dirty = !!(draft && current) && (
    draft.state !== current.state ||
    draft.message.trim() !== current.message ||
    draft.blockEngine !== current.blockEngine ||
    (draft.state !== "online" && fromLocalInput(draft.eta) !== current.eta)
  );

  function pickState(state: EngineState) {
    // Sakelar blokir ikut ke saran default status itu; admin tetap bisa
    // mengubahnya sesudahnya.
    setDraft((d) => d && { ...d, state, blockEngine: STATE_META[state].defaultBlock, eta: state === "online" ? "" : d.eta });
  }

  async function save() {
    if (!draft || !current) return;
    if (draft.blockEngine && !current.blockEngine) {
      const ok = confirm("Studio akan DIKUNCI untuk semua pelanggan (admin tetap bisa). Lanjutkan?");
      if (!ok) return;
    }
    setSaving(true);
    try {
      const d = await fetch("/api/admin/engine-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: draft.state,
          message: draft.message,
          blockEngine: draft.blockEngine,
          eta: draft.state === "online" ? null : fromLocalInput(draft.eta),
        }),
      }).then((r) => r.json());
      if (!d?.ok) throw new Error(d?.error);
      onToast(`Status engine: ${STATE_META[draft.state].label.id}.`, "success");
      await load();
    } catch (e) {
      onToast((e as Error)?.message || "Gagal simpan status.", "error");
    }
    setSaving(false);
  }

  if (loadError && !current) {
    return (
      <div className={styles.empty}>
        Status engine tidak bisa dimuat.{" "}
        <button type="button" className={styles.linkBtn} onClick={() => void load()}>Coba lagi</button>
      </div>
    );
  }
  if (!current || !draft || !preview) {
    return (
      <div className={styles.empty}>
        <div className="spinner" style={{ width: 14, height: 14 }} /> Memuat status engine
      </div>
    );
  }

  const curMeta = STATE_META[current.state];

  return (
    <div className={`${styles.wrap} animate-in`}>
      {/* ── Status sekarang ── */}
      <div className={`${styles.now} ${styles[`tone_${curMeta.tone}`]}`}>
        <div className={styles.nowLeft}>
          <div className={styles.kicker}>Status Sekarang</div>
          <div className={styles.nowState}>
            <StatusDot status={current} size={12} />
            <span>{curMeta.label.id}</span>
          </div>
          <p className={styles.nowMsg}>{statusMessage(current, "id")}</p>
        </div>
        <div className={styles.nowMeta}>
          <div><span>Studio</span><strong className={current.blockEngine ? styles.bad : styles.good}>{current.blockEngine ? "Dikunci" : "Terbuka"}</strong></div>
          <div><span>Diubah</span><strong title={fmtDateTime(current.updatedAt, "id")}>{timeAgo(current.updatedAt, "id")}</strong></div>
          {current.eta && <div><span>ETA</span><strong>{fmtDateTime(current.eta, "id")}</strong></div>}
        </div>
      </div>

      <div className={styles.grid}>
        {/* ── Editor ── */}
        <div className={styles.editor}>
          <div className={styles.sectionTitle}>1 — Pilih Status</div>
          <div className={styles.states} role="radiogroup" aria-label="Status engine">
            {ENGINE_STATES.map((s) => {
              const m = STATE_META[s];
              const active = draft.state === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`${styles.stateCard} ${styles[`tone_${m.tone}`]} ${active ? styles.stateActive : ""}`}
                  onClick={() => pickState(s)}
                >
                  <span className={styles.stateTop}>
                    <span className={styles.stateDot} />
                    <span className={styles.stateLabel}>{m.label.id}</span>
                    {current.state === s && <span className={styles.stateNow}>Aktif</span>}
                  </span>
                  <span className={styles.stateDesc}>{m.desc.id}</span>
                  <span className={styles.stateBlock}>{m.defaultBlock ? "Kunci studio" : "Studio terbuka"}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.sectionTitle}>2 — Pesan untuk Pelanggan</div>
          <div className={styles.field}>
            <textarea
              className={`input ${styles.textarea}`}
              rows={3}
              maxLength={MESSAGE_MAX}
              placeholder={STATE_META[draft.state].desc.id}
              value={draft.message}
              onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            />
            <div className={styles.fieldHint}>
              <span>Kosongkan untuk memakai kalimat bawaan (otomatis ID/EN).</span>
              <span>{draft.message.length}/{MESSAGE_MAX}</span>
            </div>
          </div>

          {draft.state !== "online" && (
            <>
              <div className={styles.sectionTitle}>3 — Perkiraan Pulih (opsional)</div>
              <div className={styles.etaRow}>
                <input
                  type="datetime-local"
                  className={`input ${styles.etaInput}`}
                  value={draft.eta}
                  onChange={(e) => setDraft({ ...draft, eta: e.target.value })}
                />
                {draft.eta && (
                  <button type="button" className="btn btn-ghost" style={{ padding: "0 18px" }} onClick={() => setDraft({ ...draft, eta: "" })}>
                    Hapus
                  </button>
                )}
              </div>
            </>
          )}

          <div className={styles.sectionTitle}>{draft.state !== "online" ? "4" : "3"} — Akses Studio</div>
          <div className={`${styles.blockRow} ${draft.blockEngine ? styles.blockRowOn : ""}`}>
            <div>
              <div className={styles.blockTitle}>Kunci studio untuk pelanggan</div>
              <div className={styles.blockDesc}>
                Server berhenti mengirim engine ke pelanggan. Admin tetap menerima engine untuk menguji perbaikan.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.blockEngine}
              aria-label="Kunci studio untuk pelanggan"
              className={`toggle danger ${draft.blockEngine ? "on" : ""}`}
              onClick={() => setDraft({ ...draft, blockEngine: !draft.blockEngine })}
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          <div className={styles.actions}>
            <button type="button" className="btn" onClick={save} disabled={!dirty || saving}>
              {saving ? <div className="spinner" /> : "Terapkan Status"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(draftOf(current))} disabled={!dirty || saving}>
              Batal
            </button>
            {dirty && <span className={styles.dirty}>Belum disimpan</span>}
          </div>
        </div>

        {/* ── Pratinjau + riwayat ── */}
        <aside className={styles.side}>
          <div className={styles.sectionTitle}>Pratinjau — yang dilihat pelanggan</div>
          <div className={styles.previewBox}>
            <div className={styles.previewLbl}>Landing / navbar</div>
            <EngineStatusPill status={preview} />
            <div className={styles.previewLbl} style={{ marginTop: 20 }}>Studio</div>
            <EngineStatusBanner status={preview} showWhenOnline />
          </div>

          <div className={styles.sectionTitle}>Riwayat</div>
          {history.length === 0 ? (
            <div className={styles.historyEmpty}>Belum ada perubahan tercatat.</div>
          ) : (
            <ol className={styles.history} data-lenis-prevent>
              {history.map((h) => {
                const m = STATE_META[h.state];
                return (
                  <li key={h.id} className={`${styles.hItem} ${styles[`tone_${m.tone}`]}`}>
                    <span className={styles.hDot} />
                    <div className={styles.hBody}>
                      <div className={styles.hHead}>
                        <span className={styles.hState}>{m.label.id}</span>
                        {h.blockEngine && <span className={styles.hLock}>Kunci</span>}
                        <span className={styles.hTime} title={fmtDateTime(h.updatedAt, "id")}>{timeAgo(h.updatedAt, "id")}</span>
                      </div>
                      {h.message && <div className={styles.hMsg}>{h.message}</div>}
                      {h.by && <div className={styles.hBy}>oleh {h.by}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
