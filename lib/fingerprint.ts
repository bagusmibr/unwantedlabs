/**
 * Fingerprint ini HANYA metadata informatif untuk panel admin.
 *
 * Identitas perangkat yang sebenarnya menentukan lolos/tidaknya diterbitkan
 * server sebagai UUID acak di cookie httpOnly (lihat /api/user/pc-check) —
 * apa pun yang dihitung browser selalu bisa dipalsukan.
 */
export function getFingerprint(): string {
  const key = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    navigator.hardwareConcurrency,
  ].join("|");

  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash << 5) - hash + key.charCodeAt(i);
  return Math.abs(hash).toString(16);
}

export type PCStatus = { allowed: boolean; deviceCount: number; reason?: string };

/**
 * Daftarkan perangkat ini dan kembalikan statusnya.
 *
 * WAJIB dipanggil oleh SETIAP halaman berbayar sebelum memakai API-nya. Cookie
 * ul_device baru terbit di sini; tanpa itu /api/engine dan /api/analytics akan
 * menolak dengan "perangkat tidak terdaftar" — dan pelanggan yang hanya membeli
 * satu produk tidak punya jalan lain untuk mendapatkannya.
 */
export async function registerDevice(): Promise<PCStatus | null> {
  try {
    const res = await fetch("/api/user/pc-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: getFingerprint() }),
    });
    const pc = await res.json();
    if (!res.ok || !pc?.ok) return null;
    return { allowed: !!pc.allowed, deviceCount: pc.deviceCount ?? 0, reason: pc.reason };
  } catch {
    return null;
  }
}
