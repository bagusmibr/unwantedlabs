"use client";
import SmoothScroll from "./SmoothScroll";
import CustomCursor from "./CustomCursor";
import { FilmGrain, ScrollProgress } from "./misc";

/** Efek yang berlaku di semua halaman. Dipasang sekali di app/layout.tsx. */
export default function FxRoot() {
  return (
    <>
      <SmoothScroll />
      <ScrollProgress />
      <FilmGrain />
      <CustomCursor />
    </>
  );
}
