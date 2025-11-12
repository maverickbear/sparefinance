import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Improve compatibility with React 19 and Next.js 16
  reactStrictMode: true,
  
  // Turbopack configuration (Next.js 16 uses Turbopack by default)
  turbopack: {},
  
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self \"https://cdn.plaid.com\"), microphone=(), geolocation=()", // Allow camera for Plaid Link card scanning
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.plaid.com", // Note: 'unsafe-eval' and 'unsafe-inline' may be needed for Next.js, cdn.plaid.com for Plaid Link
              "style-src 'self' 'unsafe-inline'", // 'unsafe-inline' needed for Tailwind CSS
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.plaid.com https://production.plaid.com https://sandbox.plaid.com https://development.plaid.com",
              "frame-src 'self' https://js.stripe.com https://cdn.plaid.com https://*.plaid.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

