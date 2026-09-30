import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://ggaurdai.com";
  const pages = ["", "/diagnostics", "/pre-dispatch", "/pre-dispatch/demo", "/privacy", "/terms", "/refund-policy"];
  return pages.map((path) => ({ url: `${origin}${path}`, lastModified: new Date(), changeFrequency: "weekly", priority: path === "" ? 1 : 0.7 }));
}
