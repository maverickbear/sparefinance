"use server";

import { createServerClient } from "@/lib/supabase-server";
import type { User } from "@supabase/supabase-js";

/**
 * Optimized helper to get authenticated user
 * This function can be reused across API functions to avoid duplicate getUser() calls
 * 
 * @param supabase - Optional Supabase client (if already created)
 * @param user - Optional user object (if already fetched)
 * @returns Object with user, userId, and supabase client
 */
export async function getAuthenticatedUser(options?: {
  supabase?: Awaited<ReturnType<typeof createServerClient>>;
  user?: User | null;
}): Promise<{
  user: User;
  userId: string;
  supabase: Awaited<ReturnType<typeof createServerClient>>;
} | null> {
  const supabase = options?.supabase || await createServerClient();
  const providedUser = options?.user;

  // Use provided user if available, otherwise fetch
  if (providedUser) {
    return {
      user: providedUser,
      userId: providedUser.id,
      supabase,
    };
  }

  // Fetch user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  return {
    user,
    userId: user.id,
    supabase,
  };
}

