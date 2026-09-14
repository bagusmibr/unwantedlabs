import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/login?next=/dashboard");

  return <>{children}</>;
}
