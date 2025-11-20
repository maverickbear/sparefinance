"use client";

import { createBrowserClient } from "@/lib/supabase-client";
import { Household, HouseholdMemberNew } from "@/lib/types/household";

const supabase = createBrowserClient();

/**
 * Map database Household to Household type
 */
function mapHousehold(row: any): Household {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    createdBy: row.createdBy,
    settings: row.settings || {},
  };
}

/**
 * Map database HouseholdMemberNew to HouseholdMemberNew type
 */
function mapHouseholdMember(row: any): HouseholdMemberNew {
  return {
    id: row.id,
    householdId: row.householdId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    isDefault: row.isDefault,
    joinedAt: new Date(row.joinedAt),
    invitedBy: row.invitedBy || null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

/**
 * Get all households for the current user
 */
export async function getUserHouseholdsClient(): Promise<Household[]> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return [];
  }

  const { data: members, error } = await supabase
    .from("HouseholdMemberNew")
    .select("Household(*)")
    .eq("userId", authUser.id)
    .eq("status", "active");

  if (error || !members) {
    console.error("Error fetching user households:", error);
    return [];
  }

  return members
    .map((m: any) => m.Household)
    .filter((h: any) => h !== null)
    .map(mapHousehold);
}

/**
 * Get the active household for the current user
 */
export async function getActiveHouseholdClient(): Promise<Household | null> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  // First try to get from UserActiveHousehold
  const { data: activeHousehold, error: activeError } = await supabase
    .from("UserActiveHousehold")
    .select("Household(*)")
    .eq("userId", authUser.id)
    .single();

  if (!activeError && activeHousehold?.Household) {
    return mapHousehold(activeHousehold.Household);
  }

  // Fallback to default (personal) household
  const { data: defaultMember, error: defaultError } = await supabase
    .from("HouseholdMemberNew")
    .select("Household(*)")
    .eq("userId", authUser.id)
    .eq("isDefault", true)
    .eq("status", "active")
    .single();

  if (defaultError || !defaultMember?.Household) {
    return null;
  }

  return mapHousehold(defaultMember.Household);
}

/**
 * Set the active household for the current user
 */
export async function setActiveHouseholdClient(householdId: string): Promise<void> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    throw new Error("User not authenticated");
  }

  // Verify user is a member of this household
  const { data: member, error: memberError } = await supabase
    .from("HouseholdMemberNew")
    .select("id")
    .eq("householdId", householdId)
    .eq("userId", authUser.id)
    .eq("status", "active")
    .single();

  if (memberError || !member) {
    throw new Error("User is not an active member of this household");
  }

  const { error } = await supabase
    .from("UserActiveHousehold")
    .upsert({
      userId: authUser.id,
      householdId,
      updatedAt: new Date().toISOString(),
    });

  if (error) {
    console.error("Error setting active household:", error);
    throw new Error(`Failed to set active household: ${error.message}`);
  }
}

/**
 * Get all members of a household
 */
export async function getHouseholdMembersClient(householdId: string): Promise<HouseholdMemberNew[]> {
  const { data: members, error } = await supabase
    .from("HouseholdMemberNew")
    .select("*")
    .eq("householdId", householdId)
    .order("role", { ascending: false })
    .order("createdAt", { ascending: true });

  if (error || !members) {
    console.error("Error fetching household members:", error);
    return [];
  }

  return members.map(mapHouseholdMember);
}

/**
 * Get household by ID
 */
export async function getHouseholdClient(householdId: string): Promise<Household | null> {
  const { data: household, error } = await supabase
    .from("Household")
    .select("*")
    .eq("id", householdId)
    .single();

  if (error || !household) {
    return null;
  }

  return mapHousehold(household);
}

