import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SecurityLogger } from "@/lib/utils/security-logging";
import { rateLimit as redisRateLimit } from "@/lib/services/redis";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { createServerClient as createSSRServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create Supabase client for middleware using request cookies
 * Configured to avoid automatic token refresh that can cause errors
 */
function createMiddlewareClient(request: NextRequest) {
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false, // Disable auto-refresh to avoid errors with invalid tokens
      persistSession: false, // Don't persist session in middleware
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // In middleware, we can't set cookies directly
        // They will be set by the response
      },
    },
  });
}

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

  // Check maintenance mode for all routes except:
  // - API routes (handled separately)
  // - Static files
  // - The maintenance page itself
  // - The landing page (/) - users can still view it
  // - Public pages (auth, pricing, etc.)
  const isMaintenancePage = pathname === "/maintenance";
  const isLandingPage = pathname === "/";
  const isPublicPage = pathname.startsWith("/auth") || 
                       pathname === "/pricing" || 
                       pathname === "/privacy-policy" || 
                       pathname === "/terms-of-service" || 
                       pathname === "/faq" ||
                       pathname.startsWith("/members/accept");
  const isStaticFile = pathname.startsWith("/_next") || 
                       pathname.startsWith("/favicon") ||
                       /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname);

  // Check maintenance mode status
  if (!isStaticFile && !pathname.startsWith("/api")) {
    try {
      // Check maintenance mode
      const serviceSupabase = createServiceRoleClient();
      const { data: settings } = await serviceSupabase
        .from("SystemSettings")
        .select("maintenanceMode")
        .eq("id", "default")
        .single();

      const isMaintenanceMode = settings?.maintenanceMode || false;

      // If user is on maintenance page but maintenance is disabled, redirect them away
      if (isMaintenancePage && !isMaintenanceMode) {
        try {
          const supabase = createMiddlewareClient(request);
          const { data: { user }, error: authError } = await supabase.auth.getUser();

          // Silently ignore expected auth errors (invalid refresh tokens, etc.)
          if (authError && (
            authError.message?.includes("refresh_token_not_found") ||
            authError.message?.includes("Invalid refresh token") ||
            authError.message?.includes("JWT expired") ||
            authError.message?.includes("Auth session missing")
          )) {
            // Expected error - user is not authenticated
            return NextResponse.redirect(new URL("/", request.url));
          }

          if (user) {
            // User is authenticated - redirect to dashboard
            return NextResponse.redirect(new URL("/dashboard", request.url));
          } else {
            // Not authenticated - redirect to landing page
            return NextResponse.redirect(new URL("/", request.url));
          }
        } catch (authError: any) {
          // Silently ignore expected auth errors
          if (authError?.message?.includes("refresh_token_not_found") ||
              authError?.message?.includes("Invalid refresh token") ||
              authError?.message?.includes("JWT expired")) {
            // Expected error - redirect to landing page
            return NextResponse.redirect(new URL("/", request.url));
          }
          // Unexpected error - redirect to landing page
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      // If maintenance is active and user is trying to access protected routes
      if (isMaintenanceMode && !isMaintenancePage && !isLandingPage && !isPublicPage) {
        // Check if user is authenticated and is super_admin
        try {
          const supabase = createMiddlewareClient(request);
          const { data: { user }, error: authError } = await supabase.auth.getUser();

          // Silently ignore expected auth errors (invalid refresh tokens, etc.)
          if (authError && (
            authError.message?.includes("refresh_token_not_found") ||
            authError.message?.includes("Invalid refresh token") ||
            authError.message?.includes("JWT expired") ||
            authError.message?.includes("Auth session missing")
          )) {
            // Expected error - user is not authenticated, redirect to maintenance
            return NextResponse.redirect(new URL("/maintenance", request.url));
          }

          if (user) {
            // User is authenticated - check if super_admin and if blocked
            const { data: userData } = await supabase
              .from("User")
              .select("role, isBlocked")
              .eq("id", user.id)
              .single();

            // Check if user is blocked (super_admin cannot be blocked)
            if (userData?.isBlocked && userData?.role !== "super_admin") {
              // User is blocked - sign them out and redirect to login
              await supabase.auth.signOut();
              return NextResponse.redirect(new URL("/auth/login?error=blocked", request.url));
            }

            // If super_admin, allow access
            if (userData?.role === "super_admin") {
              // Continue to rate limiting check
            } else {
              // Not super_admin - redirect to maintenance
              return NextResponse.redirect(new URL("/maintenance", request.url));
            }
          } else {
            // Not authenticated - redirect to maintenance
            return NextResponse.redirect(new URL("/maintenance", request.url));
          }
        } catch (authError: any) {
          // Silently ignore expected auth errors
          if (authError?.message?.includes("refresh_token_not_found") ||
              authError?.message?.includes("Invalid refresh token") ||
              authError?.message?.includes("JWT expired")) {
            // Expected error - redirect to maintenance
            return NextResponse.redirect(new URL("/maintenance", request.url));
          }
          // Unexpected error - redirect to maintenance to be safe
          return NextResponse.redirect(new URL("/maintenance", request.url));
        }
      }
    } catch (error) {
      // If error checking maintenance mode, log but don't block access
      console.error("[MIDDLEWARE] Error checking maintenance mode:", error);
    }
  }

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

