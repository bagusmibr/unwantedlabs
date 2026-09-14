import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";

// cookies() sudah membuat route ini dinamis, tapi kita tegaskan supaya
// tidak ada versi statis yang ter-cache di CDN.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Catatan: redirect() bekerja dengan melempar error, jadi TIDAK BOLEH
  // dipanggil di dalam try/catch — hasil cek disimpan dulu sebagai flag.
  const user = await getSessionUserFromCookies();

  if (!user) redirect("/login?next=/admin");
  if (!user.isAdmin) redirect("/");

  return <>{children}</>;
}
