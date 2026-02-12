import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import bundleAnalyzer from "@next/bundle-analyzer";

// Bundle analyzer
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Get and increment version from version.json
let appVersion = '0.0.1';
const versionFilePath = join(process.cwd(), 'version.json');

try {
  // Read current version
  const versionData = JSON.parse(readFileSync(versionFilePath, 'utf-8'));
  appVersion = versionData.version || '0.0.1';
  
  // Increment version (only on Vercel deployments, not local builds)
  if (process.env.VERCEL) {
    const [major, minor, patch] = appVersion.split('.').map(Number);
    const newPatch = patch + 1;
    const newVersion = `${major}.${minor}.${newPatch}`;
    
    // Write incremented version back to file
    writeFileSync(
      versionFilePath,
      JSON.stringify({ version: newVersion }, null, 2) + '\n',
      'utf-8'
    );
    
    console.log(`Version incremented: ${appVersion} → ${newVersion}`);
    appVersion = newVersion;
  }
} catch (error: unknown) {
  // If version.json doesn't exist, create it with default version
  const err = error as { code?: string };
  if (err?.code === "ENOENT") {
    try {
      writeFileSync(
        versionFilePath,
        JSON.stringify({ version: '0.0.1' }, null, 2) + '\n',
        'utf-8'
      );
      appVersion = '0.0.1';
      console.log('Created version.json with initial version 0.0.1');
    } catch (writeError) {
      console.warn('Could not create version.json:', writeError);
    }
  } else {
    console.warn("Could not read version from version.json:", error);
  }
}

// Generate build number from timestamp (unique for each build)
const buildTimestamp = new Date().toISOString();
const buildNumber = Math.floor(Date.now() / 1000); // Unix timestamp as build number

const nextConfig: NextConfig = {
  // Inject version and build metadata as environment variables
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber.toString(),
    NEXT_PUBLIC_BUILD_TIMESTAMP: buildTimestamp,
    NEXT_PUBLIC_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || '',
  },
  /* config options here */
  // Improve compatibility with React 19 and Next.js 16
  reactStrictMode: true,
  
  // Enable Cache Components (Next.js 16)
  cacheComponents: true,
  
  // Custom cache profiles
  cacheLife: {
    'static-data': {
      stale: 3600,      // 1 hour - client can use cached data
      revalidate: 1800, // 30 minutes - background revalidation
      expire: 86400     // 24 hours - maximum cache lifetime
    },
    'financial': {
      stale: 30,        // 30 seconds
      revalidate: 60,   // 1 minute
      expire: 300       // 5 minutes
    },
    'user-data': {
      stale: 60,        // 1 minute
      revalidate: 300,  // 5 minutes
      expire: 3600      // 1 hour
    }
  },
  
  // Turbopack configuration (Next.js 16 uses Turbopack by default)
  turbopack: {},
  
  // Performance optimizations
  compress: true, // Enable gzip compression
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
  },
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      'recharts', 
      '@radix-ui/react-dialog', 
      '@radix-ui/react-dropdown-menu', 
      '@radix-ui/react-popover', 
      '@radix-ui/react-select', 
      '@radix-ui/react-tabs',
      'date-fns',
      'zod',
    ],
    // Enable server actions optimization
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Webpack optimizations - Enhanced for better bundle splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          minSize: 20000,
          cacheGroups: {
            // Separate vendor chunks for better caching
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Separate large libraries
            recharts: {
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              name: 'recharts',
              priority: 15,
              reuseExistingChunk: true,
            },
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix-ui',
              priority: 12,
              reuseExistingChunk: true,
            },
            lucide: {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              name: 'lucide',
              priority: 11,
              reuseExistingChunk: true,
            },
            // Common chunks
            common: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
  
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
            value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\" \"https://checkout.stripe.com\")", // Allow payment for Stripe Payment Request API
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Allow Vercel Live feedback script (only loads when deployed on Vercel)
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://vercel.live https://www.googletagmanager.com https://va.vercel-scripts.com https://challenges.cloudflare.com https://core.sanity-cdn.com", // Sanity Studio: core.sanity-cdn.com for bridge.js
              "worker-src 'self' blob:", // Allow web workers (needed for canvas-confetti)
              "style-src 'self' 'unsafe-inline' https://api.fontshare.com", // 'unsafe-inline' for Tailwind; api.fontshare.com for Satoshi
              "img-src 'self' data: https: blob:", // blob: needed for image previews (receipt scanner, file uploads)
              "font-src 'self' data: https://api.fontshare.com https://cdn.fontshare.com", // Fontshare for Satoshi
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://app.sparefinance.com wss://app.sparefinance.com https://api.stripe.com https://js.stripe.com https://vercel.live https://www.googletagmanager.com https://*.google-analytics.com https://va.vercel-scripts.com https://challenges.cloudflare.com https://*.api.sanity.io wss://*.api.sanity.io https://sanity-cdn.com https://*.sanity-cdn.com https://registry.npmjs.org", // Sanity Studio: api.sanity.io, sanity-cdn.com (modules); registry.npmjs.org for package version check
              "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://vercel.live https://challenges.cloudflare.com", // Allow iframes
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              // Only upgrade to HTTPS in production (avoids localhost SSL errors in development)
              ...(process.env.NODE_ENV === 'production' ? ["upgrade-insecure-requests"] : []),
            ].join("; "),
          },
        ],
      },
      {
        // Disable caching for dynamic routes (dashboard, insights, etc.)
        // Note: Landing page (/) is excluded to allow back/forward cache
        source: "/(dashboard|insights|reports|planning|investments|banking|billing|profile|members)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
      {
        // Allow back/forward cache for landing page
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate, stale-while-revalidate=60",
          },
        ],
      },
    ];
  },
};

// Wrap with Sentry if DSN is configured
const configWithSentry = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // For all available options, see:
      // https://github.com/getsentry/sentry-webpack-plugin#options

      // Suppresses source map uploading logs during build
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    })
  : nextConfig;

// Wrap with bundle analyzer if enabled
export default withBundleAnalyzer(configWithSentry);

