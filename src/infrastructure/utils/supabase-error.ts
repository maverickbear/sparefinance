/**
 * Utility functions for handling Supabase errors gracefully
 */

export interface SupabaseError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Check if an error is an AbortError (e.g. Next.js dev aborting in-flight requests on cache miss).
 * These are expected in development and should not be logged as errors.
 */
export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : String(error);
  return code === "20" || message.includes("aborted") || message.includes("AbortError");
}

/**
 * Check if an error is a connection error (should be suppressed from logs)
 */
export function isConnectionError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error 
    ? error.message 
    : String(error);
  
  const connectionErrorPatterns = [
    'ENOTFOUND',
    'fetch failed',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENETUNREACH',
    'getaddrinfo',
  ];
  
  return connectionErrorPatterns.some(pattern => 
    errorMessage.includes(pattern)
  );
}

/**
 * Safely log Supabase errors, filtering out connection errors
 */
export function logSupabaseError(
  context: string,
  error: unknown,
  options?: { logConnectionErrors?: boolean }
): void {
  const shouldLog = options?.logConnectionErrors !== false;
  
  if (isConnectionError(error) && !shouldLog) {
    // Connection errors are expected when Supabase is unavailable
    // Don't spam logs with these
    return;
  }
  
  if (error instanceof Error) {
    console.error(`[${context}] Supabase error:`, {
      message: error.message,
      name: error.name,
    });
  } else {
    console.error(`[${context}] Supabase error:`, error);
  }
}

/**
 * Check if Supabase is configured and accessible
 */
export function validateSupabaseConfig(): {
  isValid: boolean;
  error?: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // New format (sb_publishable_...) is preferred, fallback to old format (anon JWT) for backward compatibility
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
               process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return {
      isValid: false,
      error: 'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY for legacy).',
    };
  }
  
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return {
      isValid: false,
      error: 'Supabase URL must start with https:// or http://',
    };
  }
  
  return { isValid: true };
}

