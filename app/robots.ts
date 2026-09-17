import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Panel dan API tidak punya nilai di hasil pencarian, dan sebagian
      // butuh sesi — jangan diindeks.
      disallow: ["/admin", "/dashboard", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
