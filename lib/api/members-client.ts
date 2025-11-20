"use client";

import { supabase } from "@/lib/supabase";

export interface HouseholdMember {
  id: string;
  ownerId: string;
  memberId: string | null;
  email: string;
  name: string | null;
  role: "admin" | "member";
  status: "pending" | "active" | "declined";
  invitationToken: string;
  invitedAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOwner?: boolean;
  avatarUrl?: string | null;
}

/**
 * Get all household members
 */
export async function getHouseholdMembersClient(): Promise<HouseholdMember[]> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return [];
  }

  // Get user's active household
  const { data: activeHousehold } = await supabase
    .from("UserActiveHousehold")
    .select("householdId")
    .eq("userId", authUser.id)
    .maybeSingle();

  let householdId = activeHousehold?.householdId;

  // Fallback to default (personal) household
  if (!householdId) {
    const { data: defaultMember } = await supabase
      .from("HouseholdMemberNew")
      .select("householdId")
      .eq("userId", authUser.id)
      .eq("isDefault", true)
      .eq("status", "active")
      .maybeSingle();

    householdId = defaultMember?.householdId || null;
  }

  if (!householdId) {
    console.error("No household found for user:", authUser.id);
    return [];
  }

  // Get household info to find owner
  const { data: household } = await supabase
    .from("Household")
    .select("createdBy")
    .eq("id", householdId)
    .single();

  const ownerId = household?.createdBy || authUser.id;

  // Get household members from new table
  // Now we can join with User table because RLS allows household members to see each other's profiles
  const { data: members, error } = await supabase
    .from("HouseholdMemberNew")
    .select(`
      *,
      user:User!HouseholdMemberNew_userId_fkey(id, email, name, role, avatarUrl)
    `)
    .eq("householdId", householdId)
    .order("role", { ascending: false }) // owner first
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching household members:", error);
    return [];
  }

  // Map to old interface for compatibility
  const householdMembers: HouseholdMember[] = (members || []).map((member: any) => {
    // Use User data if available (for active members), otherwise use data from HouseholdMemberNew (for pending invitations)
    const user = member.user as any;
    const isOwner = member.role === 'owner';
    
    return {
      id: member.id,
      ownerId: ownerId, // Keep ownerId for compatibility
      memberId: member.userId || null,
      email: user?.email || member.email || "",
      name: user?.name || member.name || null,
      role: member.role === 'owner' ? 'admin' : (member.role as "admin" | "member"),
      status: member.status as "pending" | "active" | "declined",
      invitationToken: member.invitationToken || "",
      invitedAt: member.invitedAt || member.createdAt,
      acceptedAt: member.acceptedAt || null,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      isOwner,
      avatarUrl: user?.avatarUrl || null,
    };
  });

  // Sort to ensure owner appears first
  householdMembers.sort((a, b) => {
    if (a.isOwner && !b.isOwner) return -1;
    if (!a.isOwner && b.isOwner) return 1;
    return 0;
  });

  return householdMembers;
}

/**
 * Get user's role (admin, member, or super_admin)
 * Optimized: Uses single query to check household membership
 */
export async function getUserRoleClient(): Promise<"admin" | "member" | "super_admin" | null> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  // Fetch User role and HouseholdMemberNew in parallel
  const [userResult, householdResult] = await Promise.all([
    supabase
      .from("User")
      .select("role")
      .eq("id", authUser.id)
      .single(),
    // Get user's household memberships
    supabase
      .from("HouseholdMemberNew")
      .select("role, userId, status, Household(type, createdBy)")
      .eq("userId", authUser.id)
      .eq("status", "active")
  ]);

  const userData = userResult.data;
  
  // Check super_admin first (highest priority)
  if (userData?.role === "super_admin") {
    return "super_admin";
  }

  // Check household membership
  const memberships = householdResult.data || [];
  
  // Check if user is owner of a household
  const ownedHousehold = memberships.find(
    (m: any) => {
      const household = m.Household as any;
      return household?.createdBy === authUser.id && household?.type !== 'personal';
    }
  );
  
  if (ownedHousehold) {
    // Owner role maps to 'admin' in old system
    return "admin";
  }

  // Check if user is an active member (not owner)
  const activeMember = memberships.find(
    (m: any) => {
      const household = m.Household as any;
      return household?.createdBy !== authUser.id;
    }
  );
  
  if (activeMember) {
    // Map new roles to old: 'owner'/'admin' -> 'admin', 'member' -> 'member'
    return activeMember.role === 'member' ? 'member' : 'admin';
  }

  // Fallback to User table role if no household member record exists
  if (userData?.role) {
    return userData.role as "admin" | "member" | "super_admin";
  }

  return null;
}

/**
 * Delete a household member
 */
export async function deleteMemberClient(id: string): Promise<void> {
  const { error } = await supabase.from("HouseholdMemberNew").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting member:", error);
    throw new Error(`Failed to delete member: ${error.message || JSON.stringify(error)}`);
  }
}

