"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import styles from "./admin.module.css";

interface Device {
  fingerprint: string;
  ip: string;
  userAgent: string;
  firstSeen: { _seconds: number } | null;
  lastSeen: { _seconds: number } | null;
}
interface UserRow {
  uid: string; name: string; email: string; hasAccess: boolean;
  accessGrantedAt?: { _seconds: number } | null;
  createdAt?: { _seconds: number } | null;
  devices?: Device[];
}
interface Pricing {
  normalPrice: number; discountPrice: number; discountActive: boolean;
  discountLabel: string; waNumber: string;
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
  const [tab, setTab] = useState<"users" | "pricing">("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [pricing, setPricing] = useState<Pricing>({ normalPrice: 0, discountPrice: 0, discountActive: false, discountLabel: "", waNumber: "" });
  const [pricingLoading, setPricingLoading] = useState(false);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  function showToast(msg: string, type: "success" | "error") { setToast({ msg, type }); }

  async function loadUsers() {
    setLoading(true);
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
  }

  useEffect(() => {
    loadUsers();
    fetch("/api/admin/pricing").then((r) => r.json()).then((d) => d.ok && d.data && setPricing(d.data)).catch(() => {});
  }, []);

  async function toggleAccess(uid: string, grant: boolean) {
    setActionLoading(uid + "_a");
    try {
      const d = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid, action: grant ? "grant" : "revoke" }) }).then((r) => r.json());
      if (d.ok) { setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, hasAccess: grant } : u)); showToast(grant ? "Akses diberikan." : "Akses dicabut.", "success"); }
      else showToast("Gagal ubah akses.", "error");
    } catch { showToast("Error jaringan.", "error"); }
    setActionLoading(null);
  }

  async function resetPC(uid: string) {
    if (!confirm("Reset semua perangkat untuk user ini?")) return;
    setActionLoading(uid + "_pc");
    try {
      const d = await fetch("/api/admin/reset-pc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid }) }).then((r) => r.json());
      if (d.ok) showToast("PC berhasil direset.", "success"); else showToast("Gagal reset PC.", "error");
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
    const matchFilter = filter === "all" || (filter === "active" && u.hasAccess) || (filter === "inactive" && !u.hasAccess);
    return matchSearch && matchFilter;
  });

  const totalActive = users.filter((u) => u.hasAccess).length;

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
              <h1 className={styles.pageHeaderTitle}>Panel Kontrol</h1>
            </div>
            <div className={styles.pageHeaderRight}>
              <button className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 9 }} onClick={loadUsers}>
                Refresh
              </button>
            </div>
          </div>
          <div className={styles.rule} />

          {/* Stats */}
          <div className={`${styles.statsRow} stagger`}>
            <div className={styles.statGrid}>
              <div className={styles.statCell}>
                <div className={styles.statK}>Total Akun</div>
                <div className={styles.statV}>{users.length}</div>
              </div>
              <div className={styles.statCell}>
                <div className={styles.statK}>Akses Aktif</div>
                <div className={styles.statV}>{totalActive}</div>
              </div>
              <div className={styles.statCell}>
                <div className={styles.statK}>Belum Aktif</div>
                <div className={styles.statV}>{users.length - totalActive}</div>
              </div>
              <div className={styles.statCell}>
                <div className={styles.statK}>Promo</div>
                <div className={styles.statV} style={{ fontSize: 18, paddingTop: 8 }}>{pricing.discountActive ? "Aktif" : "—"}</div>
              </div>
            </div>
          </div>

          <div className={`rule ${styles.rule}`} />

          {/* Tabs */}
          <div className={`${styles.tabsWrap} tabs`}>
            <button className={`tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>Pengguna</button>
            <button className={`tab ${tab === "pricing" ? "active" : ""}`} onClick={() => setTab("pricing")}>Harga</button>
          </div>

          {/* Users tab */}
          {tab === "users" && (
            <div className="animate-in">
              {/* Filter row */}
              <div className={styles.filterRow}>
                <input className={`input ${styles.filterSearch}`} placeholder="Cari nama atau email..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className={styles.filterBtns}>
                  {(["all", "active", "inactive"] as const).map((f) => (
                    <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`} onClick={() => setFilter(f)}>
                      {f === "all" ? "Semua" : f === "active" ? "Aktif" : "Belum"}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.tableWrap}>
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
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u) => (
                        <tr key={u.uid}>
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
                            <span className={`${styles.statusBadge} ${u.hasAccess ? styles.statusBadgeActive : ""}`}>
                              {u.hasAccess ? "Aktif" : "Belum"}
                            </span>
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
                                  <div key={dev.fingerprint} style={{
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
                            <div className={styles.actionBtns}>
                              {u.hasAccess ? (
                                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => toggleAccess(u.uid, false)} disabled={actionLoading === u.uid + "_a"}>
                                  {actionLoading === u.uid + "_a" ? <div className="spinner" style={{ width: 10, height: 10 }} /> : null}
                                  Cabut
                                </button>
                              ) : (
                                <button className={`${styles.actionBtn} ${styles.actionBtnActive}`} onClick={() => toggleAccess(u.uid, true)} disabled={actionLoading === u.uid + "_a"}>
                                  {actionLoading === u.uid + "_a" ? <div className="spinner" style={{ width: 10, height: 10 }} /> : null}
                                  Aktifkan
                                </button>
                              )}
                              <button className={styles.actionBtn} onClick={() => resetPC(u.uid)} disabled={actionLoading === u.uid + "_pc"}>
                                {actionLoading === u.uid + "_pc" ? <div className="spinner" style={{ width: 10, height: 10 }} /> : null}
                                Reset PC
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Pricing tab */}
          {tab === "pricing" && (
            <div className={`${styles.pricingWrap} animate-in`}>
              <div className={styles.pricingSection}>
                <div className={styles.pricingSectionTitle}>Konfigurasi Harga</div>
                <div className={styles.pricingFields}>
                  <div className={styles.priceRow}>
                    <div className="input-group">
                      <label className="input-label">Harga Normal (Rp)</label>
                      <input className="input" type="number" placeholder="150000" value={pricing.normalPrice || ""} onChange={(e) => setPricing({ ...pricing, normalPrice: Number(e.target.value) })} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Harga Diskon (Rp)</label>
                      <input className="input" type="number" placeholder="75000" value={pricing.discountPrice || ""} onChange={(e) => setPricing({ ...pricing, discountPrice: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Label Diskon</label>
                    <input className="input" type="text" placeholder="Promo September 50%" value={pricing.discountLabel} onChange={(e) => setPricing({ ...pricing, discountLabel: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Nomor WhatsApp Admin</label>
                    <input className="input" type="text" placeholder="6281234567890" value={pricing.waNumber} onChange={(e) => setPricing({ ...pricing, waNumber: e.target.value })} />
                  </div>
                  <div className={styles.toggleRow}>
                    <span className={styles.toggleRowLabel}>Aktifkan Harga Diskon</span>
                    <div className={`toggle ${pricing.discountActive ? "on" : ""}`} onClick={() => setPricing({ ...pricing, discountActive: !pricing.discountActive })}>
                      <div className="toggle-thumb" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className={styles.pricePreview}>
                <div className={styles.previewLbl}>Preview landing page</div>
                <div className={styles.previewPriceRow}>
                  {pricing.discountActive && pricing.discountPrice > 0 && (
                    <span className={styles.previewStrike}>Rp {pricing.normalPrice.toLocaleString("id-ID")}</span>
                  )}
                  <span className={styles.previewMain}>
                    Rp {(pricing.discountActive && pricing.discountPrice > 0 ? pricing.discountPrice : pricing.normalPrice).toLocaleString("id-ID")}
                  </span>
                  <span className={styles.previewPer}>/lifetime</span>
                </div>
              </div>

              <button className="btn" style={{ width: "100%", padding: 14 }} onClick={savePricing} disabled={pricingLoading}>
                {pricingLoading ? <div className="spinner" /> : "Simpan Perubahan"}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
