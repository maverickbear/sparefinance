/**
 * Members Repository
 * Data access layer for household members - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

export interface HouseholdMemberRow {
  id: string;
  householdId: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  role: "owner" | "admin" | "member";
  status: "pending" | "active" | "declined";
  invitationToken: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  joinedAt: string;
  invitedBy: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export class MembersRepository {
  /**
   * Find all household members for a household
   */
  async findAllByHousehold(
    householdId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<HouseholdMemberRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: members, error } = await supabase
      .from("HouseholdMember")
      .select("*")
      .eq("householdId", householdId)
      .order("role", { ascending: false })
      .order("createdAt", { ascending: false });

    if (error) {
      logger.error("[MembersRepository] Error fetching members:", error);
      throw new Error(`Failed to fetch members: ${error.message}`);
    }

    return (members || []) as HouseholdMemberRow[];
  }

  /**
   * Find member by ID
   */
  async findById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<HouseholdMemberRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[MembersRepository] Error fetching member:", error);
      throw new Error(`Failed to fetch member: ${error.message}`);
    }

    return member as HouseholdMemberRow;
  }

  /**
   * Find member by invitation token
   */
  async findByInvitationToken(
    token: string
  ): Promise<HouseholdMemberRow | null> {
    const supabase = await createServerClient();

    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .select("*")
      .eq("invitationToken", token)
      .eq("status", "pending")
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[MembersRepository] Error fetching member by token:", error);
      return null;
    }

    return member as HouseholdMemberRow;
  }

  /**
   * Find member by email and household
   */
  async findByEmailAndHousehold(
    email: string,
    householdId: string
  ): Promise<HouseholdMemberRow | null> {
    const supabase = await createServerClient();

    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("householdId", householdId)
      .maybeSingle();

    if (error) {
      logger.error("[MembersRepository] Error fetching member by email:", error);
      return null;
    }

    return member as HouseholdMemberRow;
  }

  /**
   * Find member by userId and household
   */
  async findByUserIdAndHousehold(
    userId: string,
    householdId: string
  ): Promise<HouseholdMemberRow | null> {
    const supabase = await createServerClient();

    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .select("*")
      .eq("userId", userId)
      .eq("householdId", householdId)
      .maybeSingle();

    if (error) {
      logger.error("[MembersRepository] Error fetching member by userId:", error);
      return null;
    }

    return member as HouseholdMemberRow;
  }

  /**
   * Create a new household member
   */
  async create(data: {
    id: string;
    householdId: string;
    userId: string | null;
    email: string | null;
    name: string | null;
    role: "owner" | "admin" | "member";
    status: "pending" | "active" | "declined";
    invitationToken: string | null;
    invitedAt: string;
    acceptedAt: string | null;
    joinedAt: string;
    invitedBy: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }): Promise<HouseholdMemberRow> {
    const supabase = await createServerClient();

    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .insert({
        id: data.id,
        householdId: data.householdId,
        userId: data.userId,
        email: data.email,
        name: data.name,
        role: data.role,
        status: data.status,
        invitationToken: data.invitationToken,
        invitedAt: data.invitedAt,
        acceptedAt: data.acceptedAt,
        joinedAt: data.joinedAt,
        invitedBy: data.invitedBy,
        isDefault: data.isDefault,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("[MembersRepository] Error creating member:", error);
      throw new Error(`Failed to create member: ${error.message}`);
    }

    return member as HouseholdMemberRow;
  }

  /**
   * Update a household member
   */
  async update(
    id: string,
    data: Partial<{
      userId: string | null;
      email: string | null;
      name: string | null;
      role: "owner" | "admin" | "member";
      status: "pending" | "active" | "declined";
      invitationToken: string | null;
      acceptedAt: string | null;
      updatedAt: string;
    }>
  ): Promise<HouseholdMemberRow> {
    const supabase = await createServerClient();

    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[MembersRepository] Error updating member:", error);
      throw new Error(`Failed to update member: ${error.message}`);
    }

    return member as HouseholdMemberRow;
  }

  /**
   * Delete a household member
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("HouseholdMember")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[MembersRepository] Error deleting member:", error);
      throw new Error(`Failed to delete member: ${error.message}`);
    }
  }

  /**
   * Find active memberships for a user
   */
  async findActiveMembershipsByUserId(
    userId: string
  ): Promise<Array<HouseholdMemberRow & { household?: { type: string; createdBy: string } }>> {
    const supabase = await createServerClient();

    const { data: members, error } = await supabase
      .from("HouseholdMember")
      .select(`
        *,
        Household(type, createdBy)
      `)
      .eq("userId", userId)
      .eq("status", "active");

    if (error) {
      logger.error("[MembersRepository] Error fetching memberships:", error);
      return [];
    }

    return (members || []) as Array<HouseholdMemberRow & { household?: { type: string; createdBy: string } }>;
  }

  /**
   * Find pending invitation by email
   */
  async findPendingInvitationByEmail(email: string): Promise<(HouseholdMemberRow & { Household?: { createdBy: string } | null }) | null> {
    const supabase = await createServerClient();

    const { data: pendingInvitation, error } = await supabase
      .from("HouseholdMember")
      .select("id, householdId, email, Household(createdBy)")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("[MembersRepository] Error finding pending invitation:", error);
      throw new Error(`Failed to find pending invitation: ${error.message}`);
    }

    return pendingInvitation as (HouseholdMemberRow & { Household?: { createdBy: string } | null }) | null;
  }

  /**
   * Find households created by a user
   */
  async findHouseholdsByOwner(userId: string): Promise<Array<{ id: string; name: string; type: string; createdBy: string }>> {
    const supabase = await createServerClient();

    const { data: households, error } = await supabase
      .from("Household")
      .select("id, name, type, createdBy")
      .eq("createdBy", userId);

    if (error) {
      logger.error("[MembersRepository] Error fetching households by owner:", error);
      return [];
    }

    return (households || []) as Array<{ id: string; name: string; type: string; createdBy: string }>;
  }

  /**
   * Count active members in a household (excluding a specific user)
   */
  async countActiveMembersExcludingUser(householdId: string, excludeUserId: string): Promise<number> {
    const supabase = await createServerClient();

    const { data: members, error } = await supabase
      .from("HouseholdMember")
      .select("userId")
      .eq("householdId", householdId)
      .eq("status", "active")
      .neq("userId", excludeUserId);

    if (error) {
      logger.error("[MembersRepository] Error counting members:", error);
      return 0;
    }

    return members?.length || 0;
  }

  /**
   * Count all active members in a household
   */
  async countActiveMembers(householdId: string): Promise<number> {
    const supabase = await createServerClient();

    const { data: members, error } = await supabase
      .from("HouseholdMember")
      .select("userId")
      .eq("householdId", householdId)
      .eq("status", "active");

    if (error) {
      logger.error("[MembersRepository] Error counting members:", error);
      return 0;
    }

    return members?.length || 0;
  }

  /**
   * Get active household ID for user
   */
  async getActiveHouseholdId(userId: string): Promise<string | null> {
    const supabase = await createServerClient();

    const { data: activeHousehold } = await supabase
      .from("UserActiveHousehold")
      .select("householdId")
      .eq("userId", userId)
      .maybeSingle();

    if (activeHousehold?.householdId) {
      return activeHousehold.householdId;
    }

    // Fallback to default household
    const { data: defaultMember } = await supabase
      .from("HouseholdMember")
      .select("householdId")
      .eq("userId", userId)
      .eq("isDefault", true)
      .eq("status", "active")
      .maybeSingle();

    return defaultMember?.householdId || null;
  }
}

