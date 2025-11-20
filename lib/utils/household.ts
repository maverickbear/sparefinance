"use server";

import { createServerClient } from "@/lib/supabase-server";

/**
 * Get the active household ID for a user
 * Returns the householdId from UserActiveHousehold, or falls back to default (personal) household
 */
export async function getActiveHouseholdId(userId: string): Promise<string | null> {
  try {
    const supabase = await createServerClient();

    // First try to get from UserActiveHousehold
    const { data: activeHousehold, error: activeHouseholdError } = await supabase
      .from("UserActiveHousehold")
      .select("householdId")
      .eq("userId", userId)
      .maybeSingle();

    if (!activeHouseholdError && activeHousehold?.householdId) {
      return activeHousehold.householdId;
    }

    // Fallback to default (personal) household
    const { data: defaultMember, error: defaultError } = await supabase
      .from("HouseholdMemberNew")
      .select("householdId")
      .eq("userId", userId)
      .eq("isDefault", true)
      .eq("status", "active")
      .maybeSingle();

    if (defaultError || !defaultMember?.householdId) {
      console.error("Error getting active household:", defaultError);
      return null;
    }

    return defaultMember.householdId;
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

