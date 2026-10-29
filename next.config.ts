import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Aperçu local (tools/dev-preview) : iframe servie depuis un autre port en développement.
const frameAncestors = isProd ? "'none'" : "'self' http://localhost:4173";

// Next injecte des scripts et styles inline (hydratation, next/font). Pas de nonce ici.
const csp = [
  "default-src 'self'",
  isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  isProd ? "connect-src 'self'" : "connect-src 'self' ws:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors " + frameAncestors,
].join("; ");

const securityHeaders = [
  // X-Frame-Options ne sait pas exprimer plusieurs origines : en dev, seul frame-ancestors s'applique.
  ...(isProd ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Content-Security-Policy", value: csp },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
