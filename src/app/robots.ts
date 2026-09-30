import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://ggaurdai.com";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/portal", "/upload", "/report", "/pre-dispatch/status"] }, sitemap: `${origin}/sitemap.xml` };
}
