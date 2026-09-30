import type { NextConfig } from "next";

const config: NextConfig = {
  // Performance: Enable compression
  compress: true,

  // Security: Disable source maps in production
  productionBrowserSourceMaps: false,

  // Performance: Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "blob.vercelusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Security headers
  headers: async () => {
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://cdn.jsdelivr.net https://*.vercel.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    const sharedHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
      { key: "Permissions-Policy", value: "accelerometer=(), camera=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=()" },
    ];
    return [
      {
        source: "/((?!upload/).*)",
        headers: [
          ...sharedHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: cspDirectives },
        ],
      },
      {
        source: "/upload/:path*",
        headers: [...sharedHeaders, { key: "Content-Security-Policy", value: cspDirectives }],
      },
    ];
  },
};

export default config;
