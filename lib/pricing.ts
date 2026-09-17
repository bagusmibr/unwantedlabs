/**
 * Bentuk data harga, dipakai bersama oleh route API, panel admin, dan landing
 * page. Berkas route.ts tidak boleh mengekspor nilai selain handler HTTP-nya,
 * jadi semuanya tinggal di sini.
 */

export interface ProductPricing {
  normalPrice: number;
  discountPrice: number;
  discountActive: boolean;
  discountLabel: string;
}

export interface PricingShape {
  mp4: ProductPricing;
  analytics: ProductPricing;
  waNumber: string;
  /** Kartu Analytics di landing page baru muncul kalau ini true. Dibiarkan
   *  false sampai fiturnya benar-benar jadi — jangan pajang tombol beli untuk
   *  sesuatu yang belum ada. */
  analyticsVisible: boolean;
}

export const EMPTY_PRODUCT: ProductPricing = {
  normalPrice: 0,
  discountPrice: 0,
  discountActive: false,
  discountLabel: "",
};

export const EMPTY_PRICING: PricingShape = {
  mp4: { ...EMPTY_PRODUCT },
  analytics: { ...EMPTY_PRODUCT },
  waNumber: "",
  analyticsVisible: false,
};

/** Harga yang benar-benar berlaku sekarang, dan harga coret bila ada promo. */
export function effectivePrice(p: ProductPricing): { price: number; strike: number | null } {
  if (p.discountActive && p.discountPrice > 0) {
    return { price: p.discountPrice, strike: p.normalPrice || null };
  }
  return { price: p.normalPrice, strike: null };
}

export function readProduct(raw: unknown): ProductPricing {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    normalPrice: Number(r.normalPrice) || 0,
    discountPrice: Number(r.discountPrice) || 0,
    discountActive: !!r.discountActive,
    discountLabel: String(r.discountLabel ?? ""),
  };
}
