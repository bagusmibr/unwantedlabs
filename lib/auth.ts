import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth, isAdmin } from "@/lib/firebase-admin";

export interface SessionUser {
  uid: string;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
}

async function verify(session: string | undefined): Promise<SessionUser | null> {
  if (!session) return null;
  try {
    const adminAuth = await getAdminAuth();
    // checkRevoked = true → sesi yang sudah dicabut langsung ditolak
    const decoded = await adminAuth.verifySessionCookie(session, true);

    // Sesi hanya sah untuk akun yang emailnya sudah diverifikasi.
    const user = await adminAuth.getUser(decoded.uid);
    if (!user.emailVerified) return null;
    if (user.disabled) return null;

    return {
      uid: user.uid,
      email: user.email ?? null,
      name: user.displayName ?? null,
      isAdmin: isAdmin(user.email),
    };
  } catch {
    return null;
  }
}

/** Untuk route handler (punya akses ke NextRequest). */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  return verify(req.cookies.get("session")?.value);
}

/** Untuk server component / layout. */
export async function getSessionUserFromCookies(): Promise<SessionUser | null> {
  const store = await cookies();
  return verify(store.get("session")?.value);
}

/** Kembalikan user hanya bila dia admin, selain itu null. */
export async function requireAdmin(req: NextRequest): Promise<SessionUser | null> {
  const user = await getSessionUser(req);
  return user?.isAdmin ? user : null;
}
