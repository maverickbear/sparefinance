"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import type { User } from "@supabase/supabase-js";

/**
 * Cache for user verification results
 * Stores: userId -> { exists: boolean, userId: string, timestamp: number }
 * Cache duration: 60 minutes
 */
const userVerificationCache = new Map<
  string,
  { exists: boolean; userId: string; timestamp: number }
>();

const CACHE_DURATION_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Get cached verification result if still valid
 */
function getCachedVerification(userId: string): { exists: boolean; userId: string } | null {
  const cached = userVerificationCache.get(userId);
  if (!cached) {
    return null;
  }

  const now = Date.now();
  const age = now - cached.timestamp;

  // If cache is still valid (less than 60 minutes old)
  if (age < CACHE_DURATION_MS) {
    return { exists: cached.exists, userId: cached.userId };
  }

  // Cache expired, remove it
  userVerificationCache.delete(userId);
  return null;
}

/**
 * Store verification result in cache
 */
function setCachedVerification(userId: string, exists: boolean): void {
  userVerificationCache.set(userId, {
    exists,
    userId,
    timestamp: Date.now(),
  });
}

/**
 * Clear verification cache for a specific user (useful when user is deleted/blocked)
 */
export async function clearUserVerificationCache(userId: string): Promise<void> {
  userVerificationCache.delete(userId);
}

/**
 * Verifies if the authenticated user exists in the User table
 * If not, logs out and returns false
 * 
 * PERFORMANCE OPTIMIZATION: 
 * - Accepts optional user parameter to avoid duplicate getUser() calls
 * - Caches results for 60 minutes to avoid repeated database queries
 * 
 * @param user - Optional user object from auth.getUser() to avoid duplicate calls
 * @returns {Promise<{ exists: boolean; userId: string | null }>}
 */
export async function verifyUserExists(user?: User | null): Promise<{ exists: boolean; userId: string | null }> {
  try {
    const supabase = await createServerClient();
    
    // Get user if not provided (backward compatibility)
    let authUser = user;
    if (!authUser) {
      const { data: { user: fetchedUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !fetchedUser) {
        return { exists: false, userId: null };
      }
      authUser = fetchedUser;
    }

    // Check cache first
    const cached = getCachedVerification(authUser.id);
    if (cached !== null) {
      return cached;
    }

    // Verify user exists in User table and is not deleted
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, deleted_at")
      .eq("id", authUser.id)
      .is("deleted_at", null) // Exclude deleted users
      .single();

    // If user exists in users table and is not deleted, valid
    if (!userError && userData && !userData.deleted_at) {
      setCachedVerification(authUser.id, true);
      return { exists: true, userId: authUser.id };
    }

    // Not in users table (or deleted): portal admins (admin table only) are still valid — don't log out
    const { makeAdminService } = await import("@/src/application/admin/admin.factory");
    const isPortalAdmin = await makeAdminService().isSuperAdmin(authUser.id);
    if (isPortalAdmin) {
      setCachedVerification(authUser.id, true);
      return { exists: true, userId: authUser.id };
    }

    // User doesn't exist in User table and is not a portal admin — log out
    const reason = userData?.deleted_at
      ? `User ${authUser.id} account has been deleted. Logging out.`
      : `User ${authUser.id} authenticated but not found in User table. Logging out.`;
    console.warn(`[verifyUserExists] ${reason}`);
    setCachedVerification(authUser.id, false);
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error("[verifyUserExists] Error signing out:", signOutError);
    }
    return { exists: false, userId: authUser.id };
  } catch (error) {
    console.error("[verifyUserExists] Error verifying user exists:", error);
    return { exists: false, userId: null };
  }
}

