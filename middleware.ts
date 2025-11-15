import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SecurityLogger } from "@/lib/utils/security-logging";
import { rateLimit as redisRateLimit } from "@/lib/services/redis";

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // General API routes
  "/api": {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  // Authentication routes - stricter limits
  "/api/auth": {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  // Invitation validation - very strict to prevent enumeration
  "/api/members/invite/validate": {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
  // Profile avatar upload
  "/api/profile/avatar": {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  },
};

/**
 * Fallback in-memory rate limit store (used when Redis is unavailable)
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: NextRequest): string {
  // Try to get IP from headers (works with most proxies)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0] || realIp || "unknown";
  
  // Combine IP with user agent for better identification
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  return `${ip}:${userAgent.substring(0, 50)}`;
}

/**
 * Check if request should be rate limited using Redis (with fallback to memory)
 */
async function checkRateLimit(
  clientId: string,
  path: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = `ratelimit:${clientId}:${path}`;
  
  // Try Redis first
  try {
    const result = await redisRateLimit.check(key, config.maxRequests, config.windowMs);
    return result;
  } catch (error) {
    // Fallback to in-memory store if Redis fails
    console.warn('[RateLimit] Redis unavailable, using in-memory fallback:', error);
  }

  // Fallback: In-memory rate limiting
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to clean up
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!entry || entry.resetTime < now) {
    // Create new entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get rate limit config for a path
 */
function getRateLimitConfig(pathname: string): RateLimitConfig | null {
  // Check exact matches first
  if (rateLimitConfigs[pathname]) {
    return rateLimitConfigs[pathname];
  }

  // Check prefix matches
  for (const [prefix, config] of Object.entries(rateLimitConfigs)) {
    if (pathname.startsWith(prefix)) {
      return config;
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply rate limiting to API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Get rate limit config for this path
  const config = getRateLimitConfig(pathname);
  if (!config) {
    // No rate limiting configured for this path
    return NextResponse.next();
  }

  // Check rate limit (now async)
  const clientId = getClientId(request);
  const result = await checkRateLimit(clientId, pathname, config);

  if (!result.allowed) {
    // Rate limit exceeded - log security event
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
               request.headers.get("x-real-ip") || 
               "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    SecurityLogger.rateLimitExceeded(
      `Rate limit exceeded for path ${pathname}`,
      { ip, userAgent }
    );

    // Rate limit exceeded
    const response = NextResponse.json(
      {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
      },
      { status: 429 }
    );

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set(
      "X-RateLimit-Reset",
      new Date(result.resetTime).toISOString()
    );
    response.headers.set(
      "Retry-After",
      Math.ceil((result.resetTime - Date.now()) / 1000).toString()
    );

    return response;
  }

  // Request allowed - add rate limit headers
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set(
    "X-RateLimit-Reset",
    new Date(result.resetTime).toISOString()
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

