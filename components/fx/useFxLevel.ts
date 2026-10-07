"use client";
import { useSyncExternalStore } from "react";

/**
 * Seberapa berat efek visual boleh dijalankan di perangkat ini.
 *
 *   full — desktop/laptop yang mampu: 3D penuh, kursor custom, smooth scroll
 *   lite — HP, layar sentuh, atau perangkat lemah: 3D ringan, tanpa kursor
 *          custom dan tanpa smooth scroll
 *   off  — pengguna menyalakan "kurangi gerakan": tidak ada animasi besar
 *
 * Server selalu merender "lite" (tidak tahu perangkatnya), lalu klien
 * menyesuaikan setelah hidrasi. Konten tidak pernah bergantung pada level ini
 * — hanya hiasannya.
 */
export type FxLevel = "full" | "lite" | "off";

function compute(): FxLevel {
  if (typeof window === "undefined") return "lite";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "off";
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const weakCpu = (nav.hardwareConcurrency ?? 8) <= 4;
  const weakMem = (nav.deviceMemory ?? 8) <= 4;
  const saveData = nav.connection?.saveData === true;
  if (coarse || weakCpu || weakMem || saveData) return "lite";
  return "full";
}

let cached: FxLevel | null = null;

function subscribe(cb: () => void) {
  const queries = ["(prefers-reduced-motion: reduce)", "(pointer: coarse)"].map((q) => window.matchMedia(q));
  const on = () => { cached = compute(); cb(); };
  queries.forEach((q) => q.addEventListener("change", on));
  return () => queries.forEach((q) => q.removeEventListener("change", on));
}

function getSnapshot(): FxLevel {
  if (cached === null) cached = compute();
  return cached;
}

export function useFxLevel(): FxLevel {
  return useSyncExternalStore(subscribe, getSnapshot, () => "lite");
}
