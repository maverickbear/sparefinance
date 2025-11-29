"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import type { User } from "@supabase/supabase-js";

/**
 * Verifies if the authenticated user exists in the User table
 * If not, logs out and returns false
 * 
 * PERFORMANCE OPTIMIZATION: Accepts optional user parameter to avoid duplicate getUser() calls
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

    // Verify user exists in User table
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("id")
      .eq("id", authUser.id)
      .single();

    // If user doesn't exist in User table, log out
    if (userError || !userData) {
      console.warn(`[verifyUserExists] User ${authUser.id} authenticated but not found in User table. Logging out.`);
      
      // Log out to clear session
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error("[verifyUserExists] Error signing out:", signOutError);
      }
      
      return { exists: false, userId: authUser.id };
    }

    return { exists: true, userId: authUser.id };
  } catch (error) {
    console.error("[verifyUserExists] Error verifying user exists:", error);
    return { exists: false, userId: null };
  }
}

