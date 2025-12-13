"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";

/**
 * Get the active household ID for a user
 * Returns the householdId from UserActiveHousehold, or falls back to default (personal) household
 * @param userId - The user ID to get the household for
 * @param accessToken - Optional access token for authenticated requests
 * @param refreshToken - Optional refresh token for authenticated requests
 */
export async function getActiveHouseholdId(
  userId: string,
  accessToken?: string,
  refreshToken?: string
): Promise<string | null> {
  try {
    const supabase = await createServerClient(accessToken, refreshToken);

    // First try to get from system_user_active_households
    const { data: activeHousehold, error: activeHouseholdError } = await supabase
      .from("system_user_active_households")
      .select("household_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!activeHouseholdError && activeHousehold?.household_id) {
      return activeHousehold.household_id;
    }

    // Fallback to default (personal) household
    const { data: defaultMember, error: defaultError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .eq("status", "active")
      .maybeSingle();

    // Check if there's an actual error (Supabase errors have code or message)
    // Empty error objects {} might indicate "no results found" which is valid
    if (defaultError && (defaultError.code || defaultError.message)) {
      // Handle permission denied errors gracefully (can happen during SSR)
      if (defaultError.code === '42501' || defaultError.message?.includes('permission denied')) {
        // Don't log permission denied errors - they're expected in some contexts
        return null;
      }
      // Only log non-permission errors
      console.error("Error getting active household:", {
        userId,
        code: defaultError.code,
        message: defaultError.message,
        hint: defaultError.hint,
        details: defaultError.details
      });
      return null;
    }

    if (!defaultMember?.household_id) {
      // No default household found - this is OK, user might not have one set up yet
      // Don't log this as an error, it's a valid state
      return null;
    }

    return defaultMember.household_id;
  } catch (error) {
    console.error("Error in getActiveHouseholdId:", error);
    return null;
  }
}

/**
 * Get the active household ID for the current authenticated user
 */
export async function getCurrentUserActiveHouseholdId(): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    return await getActiveHouseholdId(user.id);
  } catch (error) {
    console.error("Error in getCurrentUserActiveHouseholdId:", error);
    return null;
  }
}

