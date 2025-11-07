import { createClient } from "@supabase/supabase-js";
import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Validate Supabase URL format
if (supabaseUrl && !supabaseUrl.startsWith("https://") && !supabaseUrl.startsWith("http://")) {
  console.warn("⚠️  Supabase URL should start with https://. Current value:", supabaseUrl);
}

// Server-side Supabase client
// Use this in server components and API routes
// Uses @supabase/ssr for proper cookie handling
export async function createServerClient(accessToken?: string, refreshToken?: string) {
  // If tokens are provided, use them directly (for cached functions)
  // This avoids accessing cookies() inside cached functions
  if (accessToken && refreshToken) {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    try {
      await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch (error: any) {
      // Handle refresh token errors gracefully
      if (error?.message?.includes("refresh_token_not_found") || 
          error?.message?.includes("Invalid refresh token") ||
          error?.message?.includes("JWT expired")) {
        // Session will be invalid, but continue with unauthenticated client
      }
    }

    return client;
  }
  
  // If tokens are not provided, try to access cookies
  // If we're inside unstable_cache(), this will throw an error
  // In that case, return an unauthenticated client
  let cookieStore;
  try {
    cookieStore = await cookies();
  } catch (error: any) {
    // If we can't access cookies (e.g., inside unstable_cache()), return unauthenticated client
    if (error?.message?.includes("unstable_cache") || 
        error?.message?.includes("Dynamic data sources") ||
        error?.message?.includes("cached with")) {
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    // If it's a different error, re-throw it
    throw error;
  }
  
  // Use @supabase/ssr for automatic cookie handling
  let client;
  try {
    client = createSSRServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (!value || value === "") {
                cookieStore.delete(name);
              } else {
                cookieStore.set(name, value, options);
              }
            });
          } catch (error) {
            // Ignore cookie setting errors
          }
        },
      },
    });

    // Try to get user to check if session is valid
    const { data: { user }, error: authError } = await client.auth.getUser();
    
    // If we get a refresh token error, clear invalid cookies
    if (authError && (
      authError.message?.includes("refresh_token_not_found") || 
      authError.message?.includes("Invalid refresh token") ||
      authError.message?.includes("JWT expired") ||
      authError.message?.includes("Auth session missing")
    )) {
      // Clear all Supabase auth cookies
      const authCookieNames = [
        "sb-access-token",
        "sb-refresh-token",
        "sb-provider-token",
        "sb-provider-refresh-token",
      ];
      
      authCookieNames.forEach((cookieName) => {
        try {
          cookieStore.delete(cookieName);
        } catch (error) {
          // Ignore errors when clearing cookies
        }
      });
    }
  } catch (error: any) {
    // If there's an error, clear cookies and return unauthenticated client
    if (error?.message?.includes("refresh_token_not_found") || 
        error?.message?.includes("Invalid refresh token") ||
        error?.message?.includes("JWT expired")) {
      const authCookieNames = [
        "sb-access-token",
        "sb-refresh-token",
        "sb-provider-token",
        "sb-provider-refresh-token",
      ];
      
      authCookieNames.forEach((cookieName) => {
        try {
          cookieStore.delete(cookieName);
        } catch (e) {
          // Ignore errors
        }
      });
    }
    
    // Return an unauthenticated client
    client = createSSRServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op
        },
      },
    });
  }

  return client;
}

// Server-side Supabase client with service role key
// Use this for webhooks and admin operations that need to bypass RLS
// WARNING: This client bypasses Row Level Security - use with caution!
export function createServiceRoleClient() {
  if (!supabaseServiceRoleKey) {
    console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Falling back to anon key (may cause RLS issues).");
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

