"use client";
import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import styles from "./dashboard.module.css";
import { useLang } from "@/lib/lang";
import { registerDevice, type PCStatus } from "@/lib/fingerprint";
import { EngineStatusBanner, useEngineStatus } from "@/components/EngineStatus";

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

type LogType = "ok" | "err" | "dim" | "normal";

/**
 * Mesin MP4 melempar pesan dalam Bahasa Inggris dan tidak boleh diubah
 * (disalin apa adanya). Jadi pesannya diterjemahkan di sini, bukan di sana.
 * Yang tidak dikenali tetap ditampilkan apa adanya.
 */
const ENGINE_ID: Record<string, string> = {
  "No moov box found — this is not a valid MP4/MOV file.":
    "Kotak moov tidak ditemukan — ini bukan berkas MP4/MOV yang sah.",
  "The moov box is too large (over 256 MB).": "Kotak moov terlalu besar (lebih dari 256 MB).",
  "The moov box could not be read.": "Kotak moov tidak bisa dibaca.",
  "This file has no video track.": "Berkas ini tidak punya track video.",
  "No tracks inside moov.": "Tidak ada track di dalam moov.",
  "No audio track. This method needs audio as the source for the second track.":
    "Tidak ada track audio. Metode ini butuh audio sebagai sumber track kedua.",
  "The audio sample table (stbl) could not be read.": "Tabel sampel audio (stbl) tidak bisa dibaca.",
  "The audio sample table is incomplete.": "Tabel sampel audio tidak lengkap.",
  "The audio track has no samples.": "Track audio tidak punya sampel.",
  "No mdat box found. Fragmented files (fMP4) are not supported yet.":
    "Kotak mdat tidak ditemukan. Berkas terfragmentasi (fMP4) belum didukung.",
  "No ftyp box found.": "Kotak ftyp tidak ditemukan.",
};

function engineMsg(e: unknown, id: boolean): string {
  const raw = (e as Error)?.message ?? "";
  return id ? (ENGINE_ID[raw] ?? raw) : raw;
}

export default function StudioClient({
  hasAccess,
  lookupFailed,
  userName,
}: {
  hasAccess: boolean;
  lookupFailed: boolean;
  userName: string;
}) {
  const [pcStatus, setPcStatus] = useState<PCStatus | null>(null);
  const [checkError, setCheckError] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState("");
  /** Server menolak karena admin mengunci engine (maintenance, patched, dsb.). */
  const [engineBlocked, setEngineBlocked] = useState(false);
  /** Engine tetap dikirim walau terkunci, karena akun ini admin. */
  const [adminBypass, setAdminBypass] = useState(false);
  const { status: engineStatus } = useEngineStatus();

  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<{ text: string; type: LogType }[]>([]);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const termRef = useRef<HTMLDivElement>(null);

  const { lang } = useLang();
  const id = lang === "id";
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "6281234567890";
  const wa = (text: string) => `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;

  function addLog(text: string, type: LogType = "normal") {
    setLogs((p) => [...p, { text, type }]);
    setTimeout(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, 50);
  }

  // Daftarkan perangkat lalu — hanya bila lolos — ambil engine dari route
  // bergerbang. User tanpa akses tidak pernah menerima kodenya sama sekali.
  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;

    (async () => {
      try {
        const pc = await registerDevice();
        if (cancelled) return;
        if (!pc) { setCheckError(true); return; }

        setPcStatus(pc);
        if (!pc.allowed) return;

        const engRes = await fetch("/api/engine");
        if (cancelled) return;
        if (!engRes.ok) {
          const body = await engRes.text().catch(() => "");
          if (cancelled) return;
          if (engRes.status === 503 && body.includes("ENGINE_BLOCKED")) {
            setEngineBlocked(true);
            return;
          }
          setEngineError(id ? "Engine tidak bisa dimuat untuk akun ini." : "The engine could not be loaded for this account.");
          return;
        }
        setAdminBypass(engRes.headers.get("X-Engine-Bypass") === "admin");
        const src = await engRes.text();
        if (cancelled) return;
        // Modul UMD: menempelkan ULMP4 / ULBOOST ke window saat dijalankan.
        new Function(src)();
        if (!cancelled) setEngineReady(true);
      } catch {
        if (!cancelled) setCheckError(true);
      }
    })();

    return () => { cancelled = true; };
    // lang sengaja tidak jadi dependency: efek ini hanya boleh jalan sekali.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  const deviceAllowed = pcStatus?.allowed === true;
  const canPatch = deviceAllowed && engineReady && !!info?.hasAudio && !processing;

  async function handleFile(f: File) {
    if (!deviceAllowed || !engineReady) return;
    if (!f.name.toLowerCase().endsWith(".mp4")) {
      addLog(id ? "Hanya file .mp4 yang didukung." : "Only .mp4 files are supported.", "err");
      return;
    }
    setFile(f); setResult(null); setLogs([]);
    addLog(`${id ? "Membaca" : "Reading"}: ${f.name}`);
    try {
      const ctx = await window.ULMP4.loadMoov(f);
      const parsed = window.ULMP4.parseInfo(ctx, f.size);
      setInfo(parsed);
      addLog(`${parsed.width}x${parsed.height} @ ${parsed.fps.toFixed(2)}fps — ${(f.size / 1048576).toFixed(1)} MB`, "ok");
      if (!parsed.hasAudio) addLog(id ? "Tidak ada audio track — tidak bisa di-patch." : "No audio track — cannot patch.", "err");
      else if (parsed.audioTrakCount > 1) addLog(id ? "Sudah di-patch sebelumnya." : "Already patched.", "dim");
    } catch (e: unknown) {
      addLog(`${id ? "Gagal" : "Failed"}: ${engineMsg(e, id)}`, "err");
      setInfo(null);
    }
  }

  async function runPatch() {
    if (!canPatch || !file || !info) return;
    setProcessing(true); setResult(null); setLogs([]);
    addLog(id ? "Patch DUAL_AUDIO dimulai..." : "DUAL_AUDIO patch started...");
    try {
      const layout = await window.ULBOOST.loadLayout(file);
      const l = layout as { moov: { start: number; end: number } };
      const moovBuf = new Uint8Array(await file.slice(l.moov.start, l.moov.end).arrayBuffer());
      const r = window.ULBOOST.build(layout, moovBuf);
      r.log.forEach((line) => addLog(line));
      const blob = window.ULBOOST.buildBlob(file, layout, r);
      const name = file.name.replace(/\.[^.]+$/, "") + "_boost.mp4";
      setResult({ blob, name });
      addLog(`${id ? "Selesai" : "Done"}: ${name} (${(blob.size / 1048576).toFixed(1)} MB)`, "ok");
    } catch (e: unknown) {
      addLog(`Error: ${engineMsg(e, id)}`, "err");
    }
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
        addLog(id ? "Tersimpan." : "Saved.", "ok");
        return;
      } catch {}
    }
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a"); a.href = url; a.download = result.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    addLog(id ? "Diunduh." : "Downloaded.", "ok");
  }

  const waIcon = (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );

  return (
    <>
      <Navbar />

      <main className={styles.main}>
        <div className="wrap">
          <div className={`${styles.pageHeader} animate-in`}>
            <div className={styles.pageHeaderSub}>UNWANTED LABS — Dashboard</div>
            <h1 className={styles.pageHeaderTitle}>{userName}</h1>
          </div>
          <div className={styles.rule} />

          {lookupFailed ? (
            /* ── Status tidak bisa dibaca ── */
            <div className={`${styles.noAccess} animate-in`}>
              <div className={styles.noAccessLabel}>{id ? "Status Akses" : "Access Status"}</div>
              <h2 className={styles.noAccessTitle}>{id ? "Status Tidak Terbaca" : "Status Unavailable"}</h2>
              <p className={styles.noAccessDesc}>
                {id
                  ? "Kami tidak bisa membaca status akunmu sekarang. Muat ulang halaman ini sebentar lagi."
                  : "We couldn't read your account status right now. Reload this page in a moment."}
              </p>
              <div className={styles.noAccessDivider} />
              <a href="/dashboard" className="btn" style={{ padding: "14px 20px" }}>
                {id ? "Muat Ulang" : "Reload"}
              </a>
            </div>
          ) : !hasAccess ? (
            /* ── Belum berbayar ── */
            <div className={`${styles.noAccess} animate-in`}>
              <div className={styles.noAccessLabel}>{id ? "Status Akses" : "Access Status"}</div>
              <h2 className={styles.noAccessTitle}>{id ? "Akses Belum Aktif" : "Access Not Active"}</h2>
              <p className={styles.noAccessDesc}>
                {id ? (
                  <>Akunmu belum mendapat akses ke fitur berbayar.<br />Hubungi admin via WhatsApp untuk aktivasi.</>
                ) : (
                  <>Your account doesn&apos;t have access to paid features.<br />Contact admin via WhatsApp for activation.</>
                )}
              </p>
              <div className={styles.noAccessDivider} />
              <a
                href={wa(id ? "Halo, saya sudah daftar dan ingin membeli akses UNWANTED LABS" : "Hi, I signed up and would like to purchase access to UNWANTED LABS")}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-wa" style={{ display: "flex", gap: 10, padding: "14px 20px" }}
              >
                {waIcon}
                {id ? "Chat Admin via WhatsApp" : "Contact Admin via WhatsApp"}
              </a>
            </div>
          ) : checkError ? (
            /* ── Pemeriksaan perangkat gagal ── */
            <div className={`${styles.noAccess} animate-in`}>
              <div className={styles.noAccessLabel}>{id ? "Perangkat" : "Device"}</div>
              <h2 className={styles.noAccessTitle}>{id ? "Gagal Memeriksa Perangkat" : "Device Check Failed"}</h2>
              <p className={styles.noAccessDesc}>
                {id
                  ? "Periksa koneksi internetmu, lalu muat ulang halaman ini."
                  : "Check your internet connection, then reload this page."}
              </p>
              <div className={styles.noAccessDivider} />
              <a href="/dashboard" className="btn" style={{ padding: "14px 20px" }}>
                {id ? "Muat Ulang" : "Reload"}
              </a>
            </div>
          ) : pcStatus === null ? (
            /* ── Sedang memeriksa ── */
            <div className={styles.loadingWrap}>
              <div className="spinner" style={{ width: 20, height: 20 }} />
              <span>{id ? "Memeriksa perangkat" : "Checking device"}</span>
            </div>
          ) : !deviceAllowed ? (
            /* ── Perangkat ditolak: studio tidak dirender sama sekali ── */
            <div className={`${styles.noAccess} animate-in`}>
              <div className={styles.noAccessLabel}>{id ? "Lisensi" : "License"}</div>
              <h2 className={styles.noAccessTitle}>{id ? "Perangkat Tidak Diizinkan" : "Device Not Allowed"}</h2>
              <p className={styles.noAccessDesc}>
                {pcStatus.reason || (id ? "Akun ini sudah terdaftar di komputer lain." : "This account is already registered on another computer.")}
                <br />
                {id
                  ? "Satu lisensi berlaku untuk satu komputer. Minta admin mereset perangkatmu bila kamu ganti PC."
                  : "One license covers one computer. Ask the admin to reset your device if you changed PCs."}
              </p>
              <div className={styles.noAccessDivider} />
              <a
                href={wa(id ? "Halo, saya perlu reset perangkat UNWANTED LABS karena ganti PC" : "Hi, I need a device reset for UNWANTED LABS because I changed PCs")}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-wa" style={{ display: "flex", gap: 10, padding: "14px 20px" }}
              >
                {waIcon}
                {id ? "Minta Reset PC" : "Request PC Reset"}
              </a>
            </div>
          ) : engineBlocked ? (
            /* ── Admin mengunci engine: tampilkan alasannya, bukan error ── */
            <div className="animate-in">
              <EngineStatusBanner status={engineStatus} showWhenOnline />
              <div className={styles.noAccess}>
                <div className={styles.noAccessLabel}>MP4 Studio</div>
                <h2 className={styles.noAccessTitle}>{id ? "Studio Sedang Dikunci" : "Studio Is Locked"}</h2>
                <p className={styles.noAccessDesc}>
                  {id
                    ? "Akses dan lisensimu tetap aman. Studio akan terbuka lagi otomatis begitu engine kembali normal — pantau perkembangannya di halaman Status."
                    : "Your access and license are safe. The studio reopens automatically once the engine is back to normal — follow along on the Status page."}
                </p>
                <div className={styles.noAccessDivider} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href="/status" className="btn" style={{ padding: "14px 20px" }}>
                    {id ? "Lihat Status" : "View Status"}
                  </a>
                  <a href="/dashboard" className="btn btn-ghost" style={{ padding: "14px 20px" }}>
                    {id ? "Muat Ulang" : "Reload"}
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* ── Akses aktif + perangkat sah ── */
            <div className="animate-in">
              <EngineStatusBanner
                status={engineStatus}
                note={adminBypass ? (id
                  ? "Kamu admin — engine tetap dimuat supaya bisa menguji. Pelanggan saat ini melihat studio terkunci."
                  : "You're an admin — the engine still loads so you can test. Customers currently see a locked studio.") : undefined}
              />
              <div className={styles.statusBar}>
                <div className={styles.statusDot} />
                <span className={styles.statusText}>{id ? "Akses Aktif" : "Access Active"}</span>
                <span className={styles.statusSep}>·</span>
                <span className={styles.statusText}>{pcStatus.deviceCount}/1 {id ? "PC Terdaftar" : "PC Registered"}</span>
                {!engineReady && !engineError && (
                  <>
                    <span className={styles.statusSep}>·</span>
                    <div className="spinner" style={{ width: 12, height: 12 }} />
                    <span className={styles.statusText}>{id ? "Memuat engine" : "Loading engine"}</span>
                  </>
                )}
              </div>

              {engineError && <div className={styles.pcWarning}>{engineError}</div>}

              <div className={styles.studioLabel}>MP4 Studio</div>
              <h2 className={styles.studioTitle}>MP4 Patch Engine</h2>
              <p className={styles.studioDesc}>
                {id
                  ? "Proses berjalan 100% di browser — file tidak pernah meninggalkan perangkatmu."
                  : "Processing runs 100% in your browser — files never leave your device."}
              </p>

              <div
                className={`${styles.dropzone} ${dragging ? styles.dropzoneDrag : ""} ${file ? styles.dropzoneHas : ""}`}
                onClick={() => { if (engineReady) fileRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                style={engineReady ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
              >
                <input ref={fileRef} type="file" accept=".mp4" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                {file ? (
                  <>
                    <div className={styles.dropIcon}>{id ? "File Terpilih" : "File Selected"}</div>
                    <div className={styles.dropFileName}>{file.name}</div>
                    <div className={styles.dropFileSub}>{(file.size / 1048576).toFixed(1)} MB — {id ? "Klik untuk ganti" : "Click to change"}</div>
                  </>
                ) : (
                  <>
                    <div className={styles.dropIcon}>{id ? "Drop MP4 di sini" : "Drop MP4 here"}</div>
                    <div className={styles.dropText}>{id ? "atau klik untuk pilih file" : "or click to select a file"}</div>
                    <div className={styles.dropSub}>Format: .mp4</div>
                  </>
                )}
              </div>

              {info && (
                <>
                  <div className={styles.infoChips}>
                    <div className={styles.chip}>{info.width}×{info.height}</div>
                    <div className={styles.chip}>{info.fps.toFixed(2)} fps</div>
                    <div className={styles.chip}>{info.hasAudio ? "Audio" : "No Audio"}</div>
                    <div className={styles.chip}>{(file!.size / 1048576).toFixed(1)} MB</div>
                    {info.audioTrakCount > 1 && (
                      <div className={`${styles.chip} ${styles.chipInfo}`}>
                        {id ? "Sudah Di-patch" : "Already Patched"}
                      </div>
                    )}
                  </div>
                  <div className={styles.reminderBox}>
                    <span className={styles.reminderIcon}>—</span>
                    {id ? (
                      <span>Output akan memiliki resolusi, bitrate, dan FPS yang <strong>sama dengan video aslinya</strong>. Proses ini hanya bypass TikTok, bukan upgrade kualitas video.</span>
                    ) : (
                      <span>Output will have the <strong>same resolution, bitrate, and FPS</strong> as the original. This only bypasses TikTok, not an upgrade in video quality.</span>
                    )}
                  </div>
                </>
              )}

              {logs.length > 0 && (
                <div ref={termRef} className={styles.terminal}>
                  {logs.map((l, i) => (
                    <div key={i} className={`${styles.logLine} ${styles[`log_${l.type}`]}`}>{l.text}</div>
                  ))}
                </div>
              )}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={`btn ${!canPatch ? "btn-ghost" : ""}`}
                  onClick={runPatch}
                  disabled={!canPatch}
                >
                  {processing ? <><div className="spinner" /> {id ? "Memproses..." : "Processing..."}</> : (id ? "PROSES VIDEO" : "PROCESS VIDEO")}
                </button>
                {result && (
                  <button type="button" className="btn" onClick={downloadResult}>
                    {id ? "Unduh" : "Download"} {result.name}
                  </button>
                )}
              </div>

              {result && (
                <a href="https://www.tiktok.com/tiktokstudio/upload" target="_blank" rel="noopener noreferrer" className={styles.tiktokLink}>
                  {id ? "Buka TikTok Studio Upload" : "Open TikTok Studio Upload"}
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
