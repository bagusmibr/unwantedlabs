import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { readAccess } from "@/lib/access";
import StudioClient from "./studio-client";

export const dynamic = "force-dynamic";

/**
 * Status berbayar ditentukan DI SERVER, bukan oleh state React.
 * Klien hanya menerima hasilnya sebagai prop; mesin aslinya tetap dijaga
 * terpisah di /api/engine, jadi mengubah prop ini lewat DevTools tidak
 * membuka apa pun.
 */
export default async function DashboardPage() {
  // redirect() bekerja dengan melempar error — jangan pernah di dalam try/catch.
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/login?next=/dashboard");

  let hasAccess = false;
  let lookupFailed = false;
  try {
    const adminDb = await getAdminDb();
    const snap = await adminDb.collection("users").doc(user.uid).get();
    hasAccess = readAccess(snap.data()).mp4;
  } catch (e) {
    console.error("dashboard status error:", e);
    lookupFailed = true;
  }

  return (
    <StudioClient
      hasAccess={hasAccess}
      lookupFailed={lookupFailed}
      userName={user.name || user.email?.split("@")[0] || "Studio"}
    />
  );
}
