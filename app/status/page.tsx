import type { Metadata } from "next";
import StatusClient from "./status-client";

export const metadata: Metadata = {
  title: "Status Engine — UNWANTED LABS",
  description: "Status live MP4 Patch Engine UNWANTED LABS: online, maintenance, atau di-patch TikTok.",
  alternates: { canonical: "/status" },
};

export default function StatusPage() {
  return <StatusClient />;
}
