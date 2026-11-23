import type { MetadataRoute } from "next";
import { guides } from "@/content/guides";
import { siteUrl } from "@/lib/env";

/** /join/* and /design are deliberately excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...guides.map((g) => ({ url: `${siteUrl}/guides/${g.slug}`, lastModified: new Date(`${g.updated}T12:00:00Z`), changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
