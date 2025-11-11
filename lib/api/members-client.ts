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

  // Check if user owns a household
  const { data: ownedHousehold } = await supabase
    .from("HouseholdMember")
    .select("ownerId")
    .eq("ownerId", authUser.id)
    .limit(1)
    .maybeSingle();

  // If user doesn't own a household, get the ownerId from their membership
  let ownerId = authUser.id;
  if (!ownedHousehold) {
    const { data: memberHousehold } = await supabase
      .from("HouseholdMember")
      .select("ownerId")
      .eq("memberId", authUser.id)
      .eq("status", "active")
      .maybeSingle();

    if (memberHousehold) {
      ownerId = memberHousehold.ownerId;
    }
  }

  // Get household members
  const { data: members, error } = await supabase
    .from("HouseholdMember")
    .select("*")
    .eq("ownerId", ownerId)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching household members:", error);
    return [];
  }

  // Get avatar URLs from User table for active members
  const memberIds = (members || [])
    .filter((m: any) => m.memberId)
    .map((m: any) => m.memberId);
  
  const ownerMemberId = ownerId;
  const allUserIds = [...new Set([ownerMemberId, ...memberIds])];

  const { data: users, error: usersError } = await supabase
    .from("User")
    .select("id, avatarUrl")
    .in("id", allUserIds);

  if (usersError) {
    console.error("Error fetching user avatars:", usersError);
  }

  // Create a map of userId -> avatarUrl
  const avatarMap = new Map<string, string | null>();
  if (users) {
    users.forEach((user: any) => {
      avatarMap.set(user.id, user.avatarUrl);
    });
  }

  // Map and mark owner, and add avatarUrl
  const householdMembers: HouseholdMember[] = (members || []).map((member: any) => {
    const userId = member.memberId || member.ownerId;
    const avatarUrl = avatarMap.get(userId) || null;
    
    const mapped: HouseholdMember = {
      ...member,
      isOwner: member.ownerId === member.memberId,
      avatarUrl: avatarUrl,
    };
    return mapped;
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
 */
export async function getUserRoleClient(): Promise<"admin" | "member" | "super_admin" | null> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  // First check User table for role (includes super_admin)
  const { data: userData } = await supabase
    .from("User")
    .select("role")
    .eq("id", authUser.id)
    .single();

  if (userData?.role === "super_admin") {
    return "super_admin";
  }

  // Check if user owns a household
  const { data: ownedHousehold } = await supabase
    .from("HouseholdMember")
    .select("role")
    .eq("ownerId", authUser.id)
    .eq("memberId", authUser.id)
    .maybeSingle();

  if (ownedHousehold) {
    return ownedHousehold.role as "admin" | "member";
  }

  // Check if user is a member
  const { data: memberHousehold } = await supabase
    .from("HouseholdMember")
    .select("role")
    .eq("memberId", authUser.id)
    .eq("status", "active")
    .maybeSingle();

  if (memberHousehold) {
    return memberHousehold.role as "admin" | "member";
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
  const { error } = await supabase.from("HouseholdMember").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting member:", error);
    throw new Error(`Failed to delete member: ${error.message || JSON.stringify(error)}`);
  }
}

