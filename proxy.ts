import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16: file ini menggantikan middleware.ts.
 *
 * PENTING: ini HANYA saringan murah (cek cookie ada/tidak) supaya pengunjung
 * yang jelas belum login tidak perlu membangunkan server component.
 * Verifikasi sesi yang sebenarnya ada di app/admin/layout.tsx dan
 * app/dashboard/layout.tsx — jangan pernah mengandalkan file ini untuk keamanan.
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("session")?.value;

  const protectedRoutes = ["/dashboard", "/admin"];
  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));

  if (isProtected && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
