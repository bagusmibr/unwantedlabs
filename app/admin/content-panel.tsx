"use client";
import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_SITE_CONTENT,
  readSiteContent,
  safeUrl,
  type AnnouncementTone,
  type SiteContent,
} from "@/lib/site-content";
import styles from "./content-panel.module.css";

const TONES: { v: AnnouncementTone; label: string; desc: string }[] = [
  { v: "info", label: "Info", desc: "Abu-abu tenang" },
  { v: "promo", label: "Promo", desc: "Putih penuh + kilau" },
  { v: "warn", label: "Peringatan", desc: "Kuning" },
];

/** Tab "Konten": banner pengumuman + demo before/after di landing. */
export default function ContentPanel({ onToast }: { onToast: (msg: string, type: "success" | "error") => void }) {
  const [data, setData] = useState<SiteContent | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/admin/site").then((r) => r.json());
      if (!d?.ok) throw new Error();
      const v = readSiteContent(d.data);
      setData(v);
      setSaved(JSON.stringify(v));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => { void (async () => { await load(); })(); }, [load]);

  if (loadError && !data) {
    return <div className={styles.empty}>Konten tidak bisa dimuat. <button type="button" className={styles.linkBtn} onClick={() => void load()}>Coba lagi</button></div>;
  }
  if (!data) return <div className={styles.empty}><div className="spinner" style={{ width: 14, height: 14 }} /> Memuat konten</div>;

  const a = data.announcement;
  const d = data.demo;
  const dirty = JSON.stringify(data) !== saved;
  const setA = (patch: Partial<SiteContent["announcement"]>) => setData({ ...data, announcement: { ...a, ...patch } });
  const setD = (patch: Partial<SiteContent["demo"]>) => setData({ ...data, demo: { ...d, ...patch } });
  const badUrl = (u: string) => !!u && !safeUrl(u);

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((x) => x.json());
      if (!r?.ok) throw new Error(r?.error);
      const v = readSiteContent(r.data);
      setData(v);
      setSaved(JSON.stringify(v));
      onToast("Konten disimpan.", "success");
    } catch (e) {
      onToast((e as Error)?.message || "Gagal simpan konten.", "error");
    }
    setSaving(false);
  }

  return (
    <div className={`${styles.wrap} animate-in`}>
      {/* ── Banner pengumuman ── */}
      <section className={styles.section}>
        <div className={styles.head}>
          <div>
            <div className={styles.title}>Banner Pengumuman</div>
            <div className={styles.sub}>Teks tipis di puncak semua halaman. Pengunjung bisa menutupnya — mengubah teks membuatnya muncul lagi.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={a.active}
            aria-label="Tampilkan banner"
            className={`toggle ${a.active ? "on" : ""}`}
            onClick={() => setA({ active: !a.active })}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* Pratinjau langsung */}
        <div className={`${styles.preview} ${styles[`pv_${a.tone}`]} ${a.active ? "" : styles.previewOff}`}>
          <span className={styles.pvDot} />
          <span>{a.text.id || "Tulis pengumuman di bawah…"}</span>
          {a.link && <span className={styles.pvLink}>{a.linkLabel.id || "Selengkapnya"} →</span>}
          <span className={styles.pvClose}>×</span>
        </div>

        <div className={styles.grid2}>
          <label className="input-group">
            <span className="input-label">Teks (Indonesia)</span>
            <textarea className={`input ${styles.area}`} rows={2} maxLength={240} value={a.text.id} onChange={(e) => setA({ text: { ...a.text, id: e.target.value } })} placeholder="Promo Oktober — diskon 30% sampai tanggal 31" />
          </label>
          <label className="input-group">
            <span className="input-label">Teks (English)</span>
            <textarea className={`input ${styles.area}`} rows={2} maxLength={240} value={a.text.en} onChange={(e) => setA({ text: { ...a.text, en: e.target.value } })} placeholder="October promo — 30% off until the 31st" />
          </label>
        </div>

        <div className={styles.grid3}>
          <label className="input-group">
            <span className="input-label">Tautan (opsional)</span>
            <input className={`input ${badUrl(a.link) ? styles.invalid : ""}`} value={a.link} onChange={(e) => setA({ link: e.target.value })} placeholder="/#pricing atau https://…" />
          </label>
          <label className="input-group">
            <span className="input-label">Label tautan (ID)</span>
            <input className="input" value={a.linkLabel.id} maxLength={40} onChange={(e) => setA({ linkLabel: { ...a.linkLabel, id: e.target.value } })} placeholder="Lihat harga" />
          </label>
          <label className="input-group">
            <span className="input-label">Label tautan (EN)</span>
            <input className="input" value={a.linkLabel.en} maxLength={40} onChange={(e) => setA({ linkLabel: { ...a.linkLabel, en: e.target.value } })} placeholder="See pricing" />
          </label>
        </div>
        {badUrl(a.link) && <div className={styles.warn}>Tautan harus diawali https:// atau / — selain itu akan dikosongkan saat disimpan.</div>}

        <div className={styles.tones} role="radiogroup" aria-label="Gaya banner">
          {TONES.map((t) => (
            <button
              key={t.v}
              type="button"
              role="radio"
              aria-checked={a.tone === t.v}
              className={`${styles.tone} ${styles[`pv_${t.v}`]} ${a.tone === t.v ? styles.toneOn : ""}`}
              onClick={() => setA({ tone: t.v })}
            >
              <strong>{t.label}</strong>
              <span>{t.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Demo before/after ── */}
      <section className={styles.section}>
        <div className={styles.head}>
          <div>
            <div className={styles.title}>Demo Before / After</div>
            <div className={styles.sub}>
              Slider perbandingan di landing page. Tampil hanya bila disalakan DAN kedua URL video terisi.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={d.visible}
            aria-label="Tampilkan demo"
            className={`toggle ${d.visible ? "on" : ""}`}
            onClick={() => setD({ visible: !d.visible })}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className={styles.note}>
          Browser memutar video sesuai refresh rate layar penonton. Di layar 60Hz, 120fps terlihat sama dengan 60fps —
          jadi demo paling meyakinkan dengan <strong>rekaman slow-motion</strong> atau <strong>rekaman layar TikTok yang
          menampilkan label 120fps</strong>. Simpan video di <code>public/demo/</code> (URL <code>/demo/after.mp4</code>)
          atau di hosting mana pun (https://…). Usahakan di bawah ~10 MB.
        </div>

        <div className={styles.grid2}>
          <label className="input-group">
            <span className="input-label">URL video sebelum</span>
            <input className={`input ${badUrl(d.beforeUrl) ? styles.invalid : ""}`} value={d.beforeUrl} onChange={(e) => setD({ beforeUrl: e.target.value })} placeholder="/demo/before.mp4" />
          </label>
          <label className="input-group">
            <span className="input-label">URL video sesudah</span>
            <input className={`input ${badUrl(d.afterUrl) ? styles.invalid : ""}`} value={d.afterUrl} onChange={(e) => setD({ afterUrl: e.target.value })} placeholder="/demo/after.mp4" />
          </label>
          <label className="input-group">
            <span className="input-label">Label kiri</span>
            <input className="input" maxLength={30} value={d.beforeLabel} onChange={(e) => setD({ beforeLabel: e.target.value })} placeholder="Original" />
          </label>
          <label className="input-group">
            <span className="input-label">Label kanan</span>
            <input className="input" maxLength={30} value={d.afterLabel} onChange={(e) => setD({ afterLabel: e.target.value })} placeholder="UNWANTED" />
          </label>
          <label className="input-group">
            <span className="input-label">Keterangan (ID)</span>
            <input className="input" maxLength={240} value={d.caption.id} onChange={(e) => setD({ caption: { ...d.caption, id: e.target.value } })} placeholder="Rekaman layar TikTok, diperlambat 4×" />
          </label>
          <label className="input-group">
            <span className="input-label">Keterangan (EN)</span>
            <input className="input" maxLength={240} value={d.caption.en} onChange={(e) => setD({ caption: { ...d.caption, en: e.target.value } })} placeholder="TikTok screen recording, slowed 4×" />
          </label>
        </div>
        {d.visible && (!d.beforeUrl || !d.afterUrl) && (
          <div className={styles.warn}>Demo menyala tapi URL belum lengkap — belum akan tampil di landing.</div>
        )}
      </section>

      <div className={styles.actions}>
        <button type="button" className="btn" onClick={save} disabled={!dirty || saving}>
          {saving ? <div className="spinner" /> : "Simpan Konten"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setData(JSON.parse(saved || JSON.stringify(EMPTY_SITE_CONTENT)))} disabled={!dirty || saving}>
          Batal
        </button>
        {dirty && <span className={styles.dirty}>Belum disimpan</span>}
      </div>
    </div>
  );
}
