import type { NextConfig } from "next";

const canonicalOrigin = "https://www.trade.rfdelta.com";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" }
];

const defaultContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src 'none'",
  "worker-src 'self' blob:"
].join("; ");

const embedContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'self' https://rfdelta.com https://www.rfdelta.com https://websites.godaddy.com https://*.godaddysites.com",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src 'none'",
  "worker-src 'self' blob:"
].join("; ");

const adsenseContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self' https:",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "worker-src 'self' blob: https:"
].join("; ");

function headersWithContentSecurityPolicy(value: string) {
  return [...securityHeaders, { key: "Content-Security-Policy", value }];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "trade\\.rfdelta\\.com" }],
        destination: `${canonicalOrigin}/:path*`,
        permanent: true
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "rfdelta-daily-top-option-trades\\.vercel\\.app" }],
        destination: `${canonicalOrigin}/:path*`,
        permanent: true
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: headersWithContentSecurityPolicy(defaultContentSecurityPolicy)
      },
      {
        source: "/embed/:path*",
        headers: headersWithContentSecurityPolicy(embedContentSecurityPolicy)
      },
      {
        source: "/latest",
        headers: headersWithContentSecurityPolicy(adsenseContentSecurityPolicy)
      },
      {
        source: "/reports/:date(\\d{4}-\\d{2}-\\d{2})",
        headers: headersWithContentSecurityPolicy(adsenseContentSecurityPolicy)
      }
    ];
  }
};

export default nextConfig;
