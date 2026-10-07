"use client";
import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import styles from "./admin.module.css";
import { FEATURE_LABEL, NO_ACCESS, type Access, type Feature } from "@/lib/access";
import { EMPTY_PRICING, type PricingShape, type ProductPricing } from "@/lib/pricing";
import { STATE_META, type EngineStatus } from "@/lib/engine-status";
import { StatusDot, useEngineStatus } from "@/components/EngineStatus";
import EnginePanel from "./engine-panel";
import ContentPanel from "./content-panel";
import SignupChart from "./signup-chart";
import { motion } from "motion/react";
import SplitText from "@/components/fx/SplitText";
import { CountUp } from "@/components/fx/misc";

interface Device {
  id: string;
  ip: string;
  userAgent: string;
  firstSeen: { _seconds: number } | null;
  lastSeen: { _seconds: number } | null;
}
interface UserRow {
  uid: string; name: string; email: string;
  /** Akses per produk, sudah dihitung server termasuk kompatibilitas mundur. */
  access?: Access;
  accessGrantedAt?: { _seconds: number } | null;
  analyticsGrantedAt?: { _seconds: number } | null;
  createdAt?: { _seconds: number } | null;
  devices?: Device[];
  deviceCount?: number;
  /** Jumlah komputer berbeda yang ditolak karena kuota sudah penuh.
   *  Inilah sinyal akun dibagikan — "Jumlah PC" selalu maksimal 1. */
  attemptCount?: number;
}
function Toast({ msg, type, onClose }: { msg: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return <div className={`toast ${type === "error" ? "toast-error" : ""}`}>{msg}</div>;
}

function fmtDate(ts?: { _seconds: number } | null) {
  if (!ts) return "—";
  return new Date(ts._seconds * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "engine" | "content" | "pricing">("users");
  // Status untuk kartu ringkasan. Setelah admin menyimpan di tab Engine, nilai
  // dari panel dipakai langsung supaya kartu tidak menunggu polling berikutnya.
  const { status: liveEngine } = useEngineStatus();
  const [savedEngine, setSavedEngine] = useState<EngineStatus | null>(null);
  const engineStatus = savedEngine ?? liveEngine;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [pricing, setPricing] = useState<PricingShape>(EMPTY_PRICING);

  /** Ubah satu field pada satu produk tanpa menyentuh produk lainnya. */
  function setProduct(key: "mp4" | "analytics", patch: Partial<ProductPricing>) {
    setPricing((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }
  const [pricingLoading, setPricingLoading] = useState(false);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => { setToast({ msg, type }); }, []);

  // Tidak ada setState sinkron di sini: state `loading` memang sudah true
  // sejak awal, jadi pemuatan pertama tidak perlu menyalakannya lagi.
  const loadUsers = useCallback(async () => {
    try {
      const d = await fetch("/api/admin/users").then((r) => r.json());
      if (d.ok) {
        setUsers(d.users);
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        showToast("Akses ditolak — bukan admin.", "error");
      }
    } catch { showToast("Gagal memuat data.", "error"); setIsAdmin(false); }
    setLoading(false);
  }, [showToast]);

  const refresh = useCallback(() => {
    setLoading(true);
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    // Dibungkus fungsi async (pola yang dianjurkan React untuk kerja async di
    // efek): tidak ada setState yang jalan sebelum fetch pertama selesai.
    void (async () => { await loadUsers(); })();
    fetch("/api/admin/pricing").then((r) => r.json()).then((d) => d.ok && d.data && setPricing(d.data)).catch(() => {});
  }, [loadUsers]);

  async function toggleAccess(uid: string, feature: Feature, grant: boolean) {
    setActionLoading(`${uid}_${feature}`);
    try {
      const d = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, feature, action: grant ? "grant" : "revoke" }),
      }).then((r) => r.json());
      if (d.ok) {
        // Server mengembalikan objek access hasil akhirnya — dipakai apa adanya
        // supaya tampilan tidak pernah beda dengan isi database.
        setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, access: d.access ?? u.access } : u)));
        showToast(`${FEATURE_LABEL[feature]} ${grant ? "diaktifkan" : "dicabut"}.`, "success");
      } else showToast("Gagal ubah akses.", "error");
    } catch { showToast("Error jaringan.", "error"); }
    setActionLoading(null);
  }

  async function resetPC(uid: string) {
    if (!confirm("Reset semua perangkat untuk user ini?")) return;
    setActionLoading(uid + "_pc");
    try {
      const d = await fetch("/api/admin/reset-pc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid }) }).then((r) => r.json());
      if (d.ok) {
        showToast("PC berhasil direset.", "success");
        // Tanpa ini, kolom perangkat masih menampilkan IP lama dan kamu
        // akan menekan tombolnya dua kali karena ragu.
        await loadUsers();
      } else showToast("Gagal reset PC.", "error");
    } catch { showToast("Error jaringan.", "error"); }
    setActionLoading(null);
  }

  async function savePricing() {
    setPricingLoading(true);
    try {
      const d = await fetch("/api/admin/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pricing) }).then((r) => r.json());
      if (d.ok) showToast("Harga disimpan.", "success"); else showToast("Gagal simpan.", "error");
    } catch { showToast("Error jaringan.", "error"); }
    setPricingLoading(false);
  }

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const any = (u.access ?? NO_ACCESS).mp4 || (u.access ?? NO_ACCESS).analytics;
    const matchFilter = filter === "all" || (filter === "active" && any) || (filter === "inactive" && !any);
    return matchSearch && matchFilter;
  });

  const totalMp4 = users.filter((u) => (u.access ?? NO_ACCESS).mp4).length;
  const totalAnalytics = users.filter((u) => (u.access ?? NO_ACCESS).analytics).length;
  const totalNone = users.filter((u) => !(u.access ?? NO_ACCESS).mp4 && !(u.access ?? NO_ACCESS).analytics).length;

  if (isAdmin === false) {
    return (
      <>
        <Navbar />
        <main className={styles.main}>
          <div className="wrap" style={{ textAlign: "center", paddingTop: 100 }}>
            <h1 style={{ fontSize: 24, fontWeight: 200, marginBottom: 12 }}>Akses Ditolak</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Hanya admin yang dapat mengakses halaman ini.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="toast-container">{toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}</div>

      <main className={styles.main}>
        <div className="wrap">
          {/* Header */}
          <div className={`${styles.pageHeader} animate-in`}>
            <div className={styles.pageHeaderLeft}>
              <div className={styles.pageHeaderSub}>UNWANTED LABS — Admin</div>
              <h1 className={styles.pageHeaderTitle}><SplitText lines={[{ text: "Panel Kontrol" }]} stagger={0.03} /></h1>
            </div>
            <div className={styles.pageHeaderRight}>
              <button type="button" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 9 }} onClick={refresh}>
                Refresh
              </button>
            </div>
          </div>
          <div className={styles.rule} />

          {/* Stats */}
          <div className={`${styles.statsRow} stagger`}>
            <div className={styles.statGrid}>
              <button
                type="button"
                className={`card ${styles.statCell} ${styles.statEngine}`}
                onClick={() => setTab("engine")}
                title="Buka tab Engine"
              >
                <div className={styles.statK}>Engine</div>
                <div className={styles.statEngineV}>
                  {engineStatus ? (
                    <>
                      <StatusDot status={engineStatus} size={9} />
                      <span>{STATE_META[engineStatus.state].label.id}</span>
                    </>
                  ) : "—"}
                </div>
                <div className={styles.statSub}>
                  {engineStatus ? (engineStatus.blockEngine ? "Studio dikunci" : "Studio terbuka") : "Memuat"}
                </div>
              </button>
              <div className={`card ${styles.statCell}`}>
                <div className={styles.statK}>Total Akun</div>
                <div className={styles.statV}>{loading ? "—" : <CountUp to={users.length} />}</div>
              </div>
              <div className={`card ${styles.statCell}`}>
                <div className={styles.statK}>MP4 Aktif</div>
                <div className={styles.statV}>{loading ? "—" : <CountUp to={totalMp4} />}</div>
              </div>
              <div className={`card ${styles.statCell}`}>
                <div className={styles.statK}>Analytics Aktif</div>
                <div className={styles.statV}>{loading ? "—" : <CountUp to={totalAnalytics} />}</div>
              </div>
              <div className={`card ${styles.statCell}`}>
                <div className={styles.statK}>Belum Beli</div>
                <div className={styles.statV}>{loading ? "—" : <CountUp to={totalNone} />}</div>
              </div>
            </div>
          </div>

          {!loading && users.length > 0 && <SignupChart users={users} />}

          <div className={`rule ${styles.rule}`} />

          {/* Tabs */}
          <div className={`${styles.tabsWrap} tabs`}>
            <button type="button" className={`tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>Pengguna</button>
            <button type="button" className={`tab ${tab === "engine" ? "active" : ""}`} onClick={() => setTab("engine")}>
              Engine
            </button>
            <button type="button" className={`tab ${tab === "content" ? "active" : ""}`} onClick={() => setTab("content")}>Konten</button>
            <button type="button" className={`tab ${tab === "pricing" ? "active" : ""}`} onClick={() => setTab("pricing")}>Harga</button>
          </div>

          {/* Users tab */}
          {tab === "users" && (
            <div className="animate-in">
              {/* Filter row */}
              <div className={styles.filterRow}>
                <input className={`input ${styles.filterSearch}`} placeholder="Cari nama atau email..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className={styles.filterBtns}>
                  {(["all", "active", "inactive"] as const).map((f) => (
                    <button type="button" key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`} onClick={() => setFilter(f)}>
                      {f === "all" ? "Semua" : f === "active" ? "Aktif" : "Belum"}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.tableWrap} data-lenis-prevent>
                {loading ? (
                  <div className={styles.tableLoading}>
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                    Memuat data
                  </div>
                ) : filtered.length === 0 ? (
                  <div className={styles.emptyTable}>Tidak ada user ditemukan</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Status</th>
                        <th>Bergabung</th>
                        <th>Akses Diberikan</th>
                        <th>Perangkat / IP</th>
                        <th>PC lain coba</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u, ri) => (
                        <motion.tr
                          key={u.uid}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(ri, 15) * 0.03, duration: 0.4 }}
                        >
                          <td>
                            <div className={styles.userCell}>
                              <div className={styles.userAvatar}>{(u.name || u.email || "?")[0].toUpperCase()}</div>
                              <div>
                                <div className={styles.userName}>{u.name || "—"}</div>
                                <div className={styles.userEmail}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                              {(["mp4", "analytics"] as const).map((f) => (
                                <span
                                  key={f}
                                  className={`${styles.statusBadge} ${(u.access ?? NO_ACCESS)[f] ? styles.statusBadgeActive : ""}`}
                                  title={FEATURE_LABEL[f]}
                                >
                                  {f === "mp4" ? "MP4" : "ANALYTICS"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}>{fmtDate(u.createdAt)}</td>
                          <td style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}>{fmtDate(u.accessGrantedAt)}</td>
                          <td>
                            {/* Device / IP Info */}
                            {!u.devices || u.devices.length === 0 ? (
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>Belum login</span>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {u.devices.map((dev, idx) => (
                                  <div key={dev.id} style={{
                                    padding: "6px 10px",
                                    border: `1px solid ${u.devices!.length > 1 ? "rgba(255,100,100,0.3)" : "rgba(255,255,255,0.06)"}`,
                                    background: u.devices!.length > 1 ? "rgba(255,50,50,0.04)" : "transparent",
                                  }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      {u.devices!.length > 1 && (
                                        <span title="Multiple devices detected!" style={{ color: "rgba(255,100,100,0.9)", fontSize: 9, letterSpacing: "0.15em" }}>⚠</span>
                                      )}
                                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                                        {dev.ip}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 2, letterSpacing: "0.08em" }}>
                                      PC #{idx + 1} · Terakhir: {fmtDate(dev.lastSeen)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td>
                            {/* Sinyal akun dibagikan: berapa komputer berbeda
                                yang ditolak karena kuota sudah penuh. */}
                            {u.attemptCount && u.attemptCount > 0 ? (
                              <span
                                title="Komputer berbeda yang ditolak karena kuota penuh"
                                style={{
                                  fontFamily: "ui-monospace, monospace",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "rgba(255,120,120,0.95)",
                                  border: "1px solid rgba(255,100,100,0.3)",
                                  background: "rgba(255,50,50,0.06)",
                                  padding: "3px 9px",
                                }}
                              >
                                {u.attemptCount}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>—</span>
                            )}
                          </td>
                          <td>
                            <div className={styles.actionBtns}>
                              {/* Satu tombol per produk — pelanggan bisa membeli
                                  salah satu saja. */}
                              {(["mp4", "analytics"] as const).map((f) => {
                                const on = (u.access ?? NO_ACCESS)[f];
                                const busy = actionLoading === `${u.uid}_${f}`;
                                const short = f === "mp4" ? "MP4" : "Analytics";
                                return (
                                  <button
                                    key={f}
                                    type="button"
                                    className={`${styles.actionBtn} ${on ? styles.actionBtnDanger : styles.actionBtnActive}`}
                                    onClick={() => toggleAccess(u.uid, f, !on)}
                                    disabled={busy}
                                    title={`${on ? "Cabut" : "Aktifkan"} ${FEATURE_LABEL[f]}`}
                                  >
                                    {busy ? <div className="spinner" style={{ width: 10, height: 10 }} /> : null}
                                    {on ? `Cabut ${short}` : `Aktifkan ${short}`}
                                  </button>
                                );
                              })}
                              <button type="button" className={styles.actionBtn} onClick={() => resetPC(u.uid)} disabled={actionLoading === u.uid + "_pc"}>
                                {actionLoading === u.uid + "_pc" ? <div className="spinner" style={{ width: 10, height: 10 }} /> : null}
                                Reset PC
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Engine tab */}
          {tab === "engine" && <EnginePanel onToast={showToast} onStatus={setSavedEngine} />}

          {/* Content tab */}
          {tab === "content" && <ContentPanel onToast={showToast} />}

          {/* Pricing tab */}
          {tab === "pricing" && (
            <div className={`${styles.pricingWrap} animate-in`}>
              {(["mp4", "analytics"] as const).map((key) => {
                const prod = pricing[key];
                return (
                  <div key={key} className={styles.pricingSection}>
                    <div className={styles.pricingSectionTitle}>Harga — {FEATURE_LABEL[key]}</div>
                    <div className={styles.pricingFields}>
                      <div className={styles.priceRow}>
                        <div className="input-group">
                          <label className="input-label" htmlFor={`${key}-normal`}>Harga Normal (Rp)</label>
                          <input
                            id={`${key}-normal`}
                            className="input"
                            type="number"
                            placeholder="150000"
                            value={prod.normalPrice || ""}
                            onChange={(e) => setProduct(key, { normalPrice: Number(e.target.value) })}
                          />
                        </div>
                        <div className="input-group">
                          <label className="input-label" htmlFor={`${key}-discount`}>Harga Diskon (Rp)</label>
                          <input
                            id={`${key}-discount`}
                            className="input"
                            type="number"
                            placeholder="75000"
                            value={prod.discountPrice || ""}
                            onChange={(e) => setProduct(key, { discountPrice: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="input-group">
                        <label className="input-label" htmlFor={`${key}-label`}>Label Diskon</label>
                        <input
                          id={`${key}-label`}
                          className="input"
                          type="text"
                          placeholder="Promo September 50%"
                          value={prod.discountLabel}
                          onChange={(e) => setProduct(key, { discountLabel: e.target.value })}
                        />
                      </div>
                      <div className={styles.toggleRow}>
                        <span className={styles.toggleRowLabel}>Aktifkan Harga Diskon</span>
                        <div
                          className={`toggle ${prod.discountActive ? "on" : ""}`}
                          onClick={() => setProduct(key, { discountActive: !prod.discountActive })}
                        >
                          <div className="toggle-thumb" />
                        </div>
                      </div>
                    </div>

                    <div className={styles.pricePreview}>
                      <div className={styles.previewLbl}>Preview landing page</div>
                      <div className={styles.previewPriceRow}>
                        {prod.discountActive && prod.discountPrice > 0 && (
                          <span className={styles.previewStrike}>Rp {prod.normalPrice.toLocaleString("id-ID")}</span>
                        )}
                        <span className={styles.previewMain}>
                          Rp {(prod.discountActive && prod.discountPrice > 0 ? prod.discountPrice : prod.normalPrice).toLocaleString("id-ID")}
                        </span>
                        <span className={styles.previewPer}>/lifetime</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className={styles.pricingSection}>
                <div className={styles.pricingSectionTitle}>Umum</div>
                <div className={styles.pricingFields}>
                  <div className="input-group">
                    <label className="input-label" htmlFor="wa-number">Nomor WhatsApp Admin</label>
                    <input
                      id="wa-number"
                      className="input"
                      type="text"
                      placeholder="6281234567890"
                      value={pricing.waNumber}
                      onChange={(e) => setPricing({ ...pricing, waNumber: e.target.value })}
                    />
                  </div>
                  <div className={styles.toggleRow}>
                    <span className={styles.toggleRowLabel}>
                      Tampilkan kartu TikTok Analytics di landing page
                    </span>
                    <div
                      className={`toggle ${pricing.analyticsVisible ? "on" : ""}`}
                      onClick={() => setPricing({ ...pricing, analyticsVisible: !pricing.analyticsVisible })}
                    >
                      <div className="toggle-thumb" />
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, margin: 0 }}>
                    Biarkan mati sampai fitur Analytics benar-benar jalan. Menyalakannya
                    sekarang berarti memajang tombol beli untuk sesuatu yang belum ada.
                  </p>
                </div>
              </div>

              <button type="button" className="btn" style={{ width: "100%", padding: 14 }} onClick={savePricing} disabled={pricingLoading}>
                {pricingLoading ? <div className="spinner" /> : "Simpan Perubahan"}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
