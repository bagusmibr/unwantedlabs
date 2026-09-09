"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Navbar from "@/components/Navbar";
import styles from "./dashboard.module.css";

type PCStatus = { allowed: boolean; deviceCount: number; reason?: string };

declare global {
  interface Window {
    ULMP4: { loadMoov: (f: File) => Promise<unknown>; parseInfo: (ctx: unknown, size: number) => VideoInfo };
    ULBOOST: {
      loadLayout: (f: File) => Promise<unknown>;
      build: (layout: unknown, buf: Uint8Array) => { log: string[]; newMoov: Uint8Array };
      buildBlob: (f: File, layout: unknown, r: { newMoov: Uint8Array }) => Blob;
    };
  }
}

interface VideoInfo { fps: number; width: number; height: number; duration: number; hasAudio: boolean; audioTrakCount: number; }

function getFingerprint(): string {
  const key = [navigator.userAgent, navigator.language, screen.width, screen.height, navigator.hardwareConcurrency].join("|");
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash << 5) - hash + key.charCodeAt(i);
  return Math.abs(hash).toString(16);
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [pcStatus, setPcStatus] = useState<PCStatus | null>(null);
  const [libsLoaded, setLibsLoaded] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<{ text: string; type: "ok" | "err" | "dim" | "normal" }[]>([]);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const termRef = useRef<HTMLDivElement>(null);

  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "6281234567890";
  const waUrl = `https://wa.me/${waNumber}?text=Halo%2C%20saya%20sudah%20daftar%20dan%20ingin%20membeli%20akses%20UNWANTED%20LABS`;

  function addLog(text: string, type: "ok" | "err" | "dim" | "normal" = "normal") {
    setLogs((p) => [...p, { text, type }]);
    setTimeout(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, 50);
  }

  useEffect(() => {
    try { const s = localStorage.getItem("ul_user"); if (s) setUser(JSON.parse(s)); } catch {}
    async function init() {
      try {
        const st = await fetch("/api/user/status").then((r) => r.json());
        setHasAccess(st.hasAccess ?? false);
        if (st.hasAccess) {
          const pc = await fetch("/api/user/pc-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fingerprint: getFingerprint(), userAgent: navigator.userAgent }),
          }).then((r) => r.json());
          setPcStatus(pc);
        }
      } catch {}
    }
    init();
  }, []);

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".mp4")) { addLog("Hanya file .mp4 yang didukung.", "err"); return; }
    setFile(f); setResult(null); setLogs([]);
    addLog(`Membaca: ${f.name}`);
    try {
      const ctx = await window.ULMP4.loadMoov(f);
      const parsed = window.ULMP4.parseInfo(ctx, f.size);
      setInfo(parsed);
      addLog(`${parsed.width}x${parsed.height} @ ${parsed.fps.toFixed(2)}fps — ${(f.size / 1048576).toFixed(1)} MB`, "ok");
      if (!parsed.hasAudio) addLog("Tidak ada audio track — tidak bisa di-patch.", "err");
      else if (parsed.audioTrakCount > 1) addLog("Sudah di-patch sebelumnya.", "dim");
    } catch (e: unknown) { addLog(`Gagal: ${(e as Error).message}`, "err"); setInfo(null); }
  }

  async function runPatch() {
    if (!file || !info || !info.hasAudio || processing) return;
    setProcessing(true); setResult(null); setLogs([]);
    addLog("DUAL_AUDIO patch dimulai...");
    try {
      const layout = await window.ULBOOST.loadLayout(file);
      const l = layout as { moov: { start: number; end: number } };
      const moovBuf = new Uint8Array(await file.slice(l.moov.start, l.moov.end).arrayBuffer());
      const r = window.ULBOOST.build(layout, moovBuf);
      r.log.forEach((line) => addLog(line));
      const blob = window.ULBOOST.buildBlob(file, layout, r);
      const name = file.name.replace(/\.[^.]+$/, "") + "_boost.mp4";
      setResult({ blob, name });
      addLog(`Selesai: ${name} (${(blob.size / 1048576).toFixed(1)} MB)`, "ok");
    } catch (e: unknown) { addLog(`Error: ${(e as Error).message}`, "err"); }
    setProcessing(false);
  }

  async function downloadResult() {
    if (!result) return;
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as unknown as { showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: result.name, types: [{ description: "MP4", accept: { "video/mp4": [".mp4"] } }],
        });
        await result.blob.stream().pipeTo(await handle.createWritable());
        addLog("Tersimpan.", "ok"); return;
      } catch {}
    }
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a"); a.href = url; a.download = result.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    addLog("Diunduh.", "ok");
  }

  const canPatch = info?.hasAudio && (info?.audioTrakCount ?? 0) <= 1 && libsLoaded && !processing;

  return (
    <>
      <Script src="/mp4.js" />
      <Script src="/boost.js" onLoad={() => setLibsLoaded(true)} />
      <Navbar />

      <main className={styles.main}>
        <div className="wrap">
          <div className={`${styles.pageHeader} animate-in`}>
            <div className={styles.pageHeaderSub}>UNWANTED LABS — Dashboard</div>
            <h1 className={styles.pageHeaderTitle}>{user?.name || "Studio"}</h1>
          </div>
          <div className={styles.rule} />

          {hasAccess === null ? (
            <div className={styles.loadingWrap}>
              <div className="spinner" style={{ width: 20, height: 20 }} />
              <span>Memuat status akses</span>
            </div>
          ) : !hasAccess ? (
            /* ── No access state ── */
            <div className={`${styles.noAccess} animate-in`}>
              <div className={styles.noAccessLabel}>Status Akses</div>
              <h2 className={styles.noAccessTitle}>Akses Belum Aktif</h2>
              <p className={styles.noAccessDesc}>
                Akunmu belum mendapat akses ke fitur berbayar.<br />
                Hubungi admin via WhatsApp untuk aktivasi.
              </p>
              <div className={styles.noAccessDivider} />
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn btn-wa" style={{ display: "flex", gap: 10, padding: "14px 20px" }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chat Admin via WhatsApp
              </a>
            </div>
          ) : (
            /* ── Has access ── */
            <div className="animate-in">
              {pcStatus && !pcStatus.allowed && (
                <div className={styles.pcWarning}>
                  Perangkat tidak diizinkan — {pcStatus.reason}
                </div>
              )}

              {/* Status bar */}
              <div className={styles.statusBar}>
                <div className={styles.statusDot} />
                <span className={styles.statusText}>Akses Aktif</span>
                <span className={styles.statusSep}>·</span>
                <span className={styles.statusText}>{pcStatus?.deviceCount ?? 0}/1 PC Terdaftar</span>
                {!libsLoaded && (
                  <>
                    <span className={styles.statusSep}>·</span>
                    <div className="spinner" style={{ width: 12, height: 12 }} />
                    <span className={styles.statusText}>Memuat engine</span>
                  </>
                )}
              </div>

              {/* Studio */}
              <div className={styles.studioLabel}>MP4 Studio</div>
              <h2 className={styles.studioTitle}>MP4 Patch Engine</h2>
              <p className={styles.studioDesc}>
                Proses berjalan 100% di browser — file tidak pernah meninggalkan perangkatmu.
              </p>

              {/* Drop zone */}
              <div
                className={`${styles.dropzone} ${dragging ? styles.dropzoneDrag : ""} ${file ? styles.dropzoneHas : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <input ref={fileRef} type="file" accept=".mp4" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                {file ? (
                  <>
                    <div className={styles.dropIcon}>File Terpilih</div>
                    <div className={styles.dropFileName}>{file.name}</div>
                    <div className={styles.dropFileSub}>{(file.size / 1048576).toFixed(1)} MB — Klik untuk ganti</div>
                  </>
                ) : (
                  <>
                    <div className={styles.dropIcon}>Drop MP4 di sini</div>
                    <div className={styles.dropText}>atau klik untuk pilih file</div>
                    <div className={styles.dropSub}>Format: .mp4</div>
                  </>
                )}
              </div>

              {/* Info chips */}
              {info && (
                <div className={styles.infoChips}>
                  <div className={styles.chip}>{info.width}×{info.height}</div>
                  <div className={styles.chip}>{info.fps.toFixed(2)} fps</div>
                  <div className={styles.chip}>{info.hasAudio ? "Audio" : "No Audio"}</div>
                  <div className={styles.chip}>{(file!.size / 1048576).toFixed(1)} MB</div>
                  {info.audioTrakCount > 1 && <div className={`${styles.chip} ${styles.chipWarn}`}>Sudah Di-patch</div>}
                </div>
              )}

              {/* Terminal */}
              {logs.length > 0 && (
                <div ref={termRef} className={styles.terminal}>
                  {logs.map((l, i) => (
                    <div key={i} className={`${styles.logLine} ${styles[`log_${l.type}`]}`}>{l.text}</div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className={styles.actions}>
                <button
                  className={`btn ${!canPatch || (info?.audioTrakCount ?? 0) > 1 ? "btn-ghost" : ""}`}
                  onClick={runPatch}
                  disabled={!canPatch || (info?.audioTrakCount ?? 0) > 1}
                >
                  {processing ? <><div className="spinner" /> Memproses...</> : "PROSES VIDEO"}
                </button>
                {result && (
                  <button className="btn" onClick={downloadResult}>
                    Unduh {result.name}
                  </button>
                )}
              </div>

              {result && (
                <a href="https://www.tiktok.com/tiktokstudio/upload" target="_blank" rel="noopener noreferrer" className={styles.tiktokLink}>
                  Buka TikTok Studio Upload
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
