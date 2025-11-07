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

  // Map and mark owner
  const householdMembers: HouseholdMember[] = (members || []).map((member: any) => {
    const mapped: HouseholdMember = {
      ...member,
      isOwner: member.ownerId === member.memberId,
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
 * Get user's role (admin or member)
 */
export async function getUserRoleClient(): Promise<"admin" | "member" | null> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
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

