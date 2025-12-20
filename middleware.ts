import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SecurityLogger } from "@/lib/utils/security-logging";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { generateCorrelationId } from "@/src/infrastructure/utils/structured-logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// New format (sb_publishable_...) is preferred, fallback to old format (anon JWT) for backward compatibility
// Publishable keys are safe to expose and have the same privileges as anon keys
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Create Supabase client for middleware using request cookies
 * Configured to avoid automatic token refresh that can cause errors
 */
function createMiddlewareClient(request: NextRequest) {
  // supabaseAnonKey is validated at module load time (throws error if missing)
  return createSSRServerClient(supabaseUrl, supabaseAnonKey!, {
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
  // Profile avatar upload (v2)
  "/api/v2/profile/avatar": {
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
 * Check if request should be rate limited (in-memory)
 */
async function checkRateLimit(
  clientId: string,
  path: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = `ratelimit:${clientId}:${path}`;

  // In-memory rate limiting
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

/**
 * Patterns that indicate malicious/scanner requests
 * These should be blocked immediately without processing
 */
const MALICIOUS_PATTERNS = [
  /\.php$/i,                    // PHP files (we don't use PHP)
  /\.asp$/i,                     // ASP files
  /\.aspx$/i,                    // ASPX files
  /\.jsp$/i,                     // JSP files
  /\.cgi$/i,                     // CGI scripts
  /\.pl$/i,                      // Perl scripts
  /\/admin\.php/i,               // Common admin panel attempts
  /\/wp-admin/i,                  // WordPress admin
  /\/wp-login/i,                  // WordPress login
  /\/phpmyadmin/i,                // phpMyAdmin
  /\/\.env$/i,                    // Environment files
  /\/\.git/i,                     // Git directories
  /\/\.svn/i,                     // SVN directories
  /\/\.well-known\/pki-validation/i, // SSL validation abuse
  /\/xmlrpc\.php/i,               // WordPress XML-RPC
  /\/shell\.php/i,                // Common backdoor names
  /\/cmd\.php/i,                  // Common backdoor names
  /\/eval\.php/i,                 // Common backdoor names
];

/**
 * Check if a path matches malicious patterns
 */
function isMaliciousRequest(pathname: string): boolean {
  return MALICIOUS_PATTERNS.some(pattern => pattern.test(pathname));
}

export async function middleware(request: NextRequest) {
  // Generate correlation ID for request tracking
  const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
  const { pathname } = request.nextUrl;

  // Block malicious requests immediately (before any other processing)
  if (isMaliciousRequest(pathname)) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Log security event
    SecurityLogger.suspiciousActivity(
      `Blocked malicious request: ${pathname}`,
      {
        ip,
        userAgent,
        details: {
          pathname,
          type: "malicious_pattern"
        }
      }
    );

    // Return 403 Forbidden immediately
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Access denied"
      },
      {
        status: 403,
        headers: {
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        }
      }
    );
  }

  // Check authentication for protected routes
  const protectedPaths = ["/dashboard", "/settings", "/reports", "/portal-management", "/transactions", "/planning", "/members", "/insights"];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtectedPath) {
    try {
      const supabase = createMiddlewareClient(request);
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        const redirectUrl = new URL("/auth/login", request.url);
        redirectUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(redirectUrl);
      }
    } catch (error) {
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Check maintenance mode for all routes except:
  // - API routes (handled separately)
  // - Static files
  // - The maintenance page itself
  // Note: Landing page (/) and auth pages are blocked during maintenance
  // Only super_admin users can access these pages during maintenance
  const isMaintenancePage = pathname === "/maintenance";
  const isAccountDeletedPage = pathname === "/account-deleted";
  const isLandingPage = pathname === "/";
  const isPublicPage = pathname.startsWith("/auth") ||
    pathname === "/privacy-policy" ||
    pathname === "/terms-of-service" ||
    pathname === "/faq" ||
    pathname.startsWith("/members/accept") ||
    pathname.startsWith("/design");
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
          const errorMessage = authError?.message?.toLowerCase() || "";
          const errorCode = (authError as any)?.code?.toLowerCase() || "";
          if (authError && (
            errorCode === "refresh_token_not_found" ||
            errorMessage.includes("refresh_token_not_found") ||
            errorMessage.includes("refresh token not found") ||
            errorMessage.includes("invalid refresh token") ||
            errorMessage.includes("jwt expired") ||
            errorMessage.includes("auth session missing")
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
          const errorMessage = authError?.message?.toLowerCase() || "";
          const errorCode = authError?.code?.toLowerCase() || "";
          if (errorCode === "refresh_token_not_found" ||
            errorMessage.includes("refresh_token_not_found") ||
            errorMessage.includes("refresh token not found") ||
            errorMessage.includes("invalid refresh token") ||
            errorMessage.includes("jwt expired")) {
            // Expected error - redirect to landing page
            return NextResponse.redirect(new URL("/", request.url));
          }
          // Unexpected error - redirect to landing page
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      // If maintenance is active, check if user is super_admin
      // Landing page, auth pages, and protected routes should all redirect to maintenance
      // except for super_admin users
      if (isMaintenanceMode && !isMaintenancePage) {
        // Check if user is authenticated and is super_admin
        try {
          const supabase = createMiddlewareClient(request);
          const { data: { user }, error: authError } = await supabase.auth.getUser();

          // Silently ignore expected auth errors (invalid refresh tokens, etc.)
          const errorMessage2 = authError?.message?.toLowerCase() || "";
          const errorCode2 = (authError as any)?.code?.toLowerCase() || "";
          if (authError && (
            errorCode2 === "refresh_token_not_found" ||
            errorMessage2.includes("refresh_token_not_found") ||
            errorMessage2.includes("refresh token not found") ||
            errorMessage2.includes("invalid refresh token") ||
            errorMessage2.includes("jwt expired") ||
            errorMessage2.includes("auth session missing")
          )) {
            // Expected error - user is not authenticated, redirect to maintenance
            return NextResponse.redirect(new URL("/maintenance", request.url));
          }

          if (user) {
            // User is authenticated - check if super_admin and if blocked
            const { data: userData } = await supabase
              .from("core.users")
              .select("role, isBlocked")
              .eq("id", user.id)
              .single();

            // Check if user is blocked (super_admin cannot be blocked)
            if (userData?.isBlocked && userData?.role !== "super_admin") {
              // User is blocked - sign them out and redirect to account blocked page
              await supabase.auth.signOut();
              return NextResponse.redirect(new URL("/account-blocked", request.url));
            }

            // If super_admin, allow access to all pages (landing, auth, protected routes)
            if (userData?.role === "super_admin") {
              // Continue to rate limiting check
            } else {
              // Not super_admin - redirect to maintenance (blocks landing page, auth pages, and protected routes)
              return NextResponse.redirect(new URL("/maintenance", request.url));
            }
          } else {
            // Not authenticated - redirect to maintenance (blocks landing page and auth pages)
            return NextResponse.redirect(new URL("/maintenance", request.url));
          }
        } catch (authError: any) {
          // Silently ignore expected auth errors
          const errorMessage3 = authError?.message?.toLowerCase() || "";
          const errorCode3 = authError?.code?.toLowerCase() || "";
          if (errorCode3 === "refresh_token_not_found" ||
            errorMessage3.includes("refresh_token_not_found") ||
            errorMessage3.includes("refresh token not found") ||
            errorMessage3.includes("invalid refresh token") ||
            errorMessage3.includes("jwt expired")) {
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

  // Note: Account deletion is now immediate, so no need to check for deletedAt
  // If a user is deleted, they won't exist in auth.users and won't be authenticated

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

    // Add rate limit headers and correlation ID
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
    response.headers.set("X-Correlation-ID", correlationId);

    return response;
  }

  // Request allowed - add rate limit headers and correlation ID
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set(
    "X-RateLimit-Reset",
    new Date(result.resetTime).toISOString()
  );
  response.headers.set("X-Correlation-ID", correlationId);

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

