/**
 * Members Repository
 * Data access layer for household members - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

export interface HouseholdMemberRow {
  id: string;
  household_id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  role: "owner" | "admin" | "member";
  status: "pending" | "active" | "declined";
  invitation_token: string | null;
  invited_at: string;
  accepted_at: string | null;
  joined_at: string;
  invited_by: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
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
      .from("household_members")
      .select("*")
      .eq("household_id", householdId)
      .order("role", { ascending: false })
      .order("created_at", { ascending: false });

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
      .from("household_members")
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
      .from("household_members")
      .select("*")
      .eq("invitation_token", token)
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
      .from("household_members")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("household_id", householdId)
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
      .from("household_members")
      .select("*")
      .eq("user_id", userId)
      .eq("household_id", householdId)
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
      .from("household_members")
      .insert({
        id: data.id,
        household_id: data.householdId,
        user_id: data.userId,
        email: data.email,
        name: data.name,
        role: data.role,
        status: data.status,
        invitation_token: data.invitationToken,
        invited_at: data.invitedAt,
        accepted_at: data.acceptedAt,
        joined_at: data.joinedAt,
        invited_by: data.invitedBy,
        is_default: data.isDefault,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
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

    const updateData: any = {};
    if (data.userId !== undefined) updateData.user_id = data.userId;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.invitationToken !== undefined) updateData.invitation_token = data.invitationToken;
    if (data.acceptedAt !== undefined) updateData.accepted_at = data.acceptedAt;
    if (data.updatedAt !== undefined) updateData.updated_at = data.updatedAt;

    const { data: member, error } = await supabase
      .from("household_members")
      .update(updateData)
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
      .from("household_members")
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
  ): Promise<Array<HouseholdMemberRow & { household?: { type: string; created_by: string } }>> {
    const supabase = await createServerClient();

    const { data: members, error } = await supabase
      .from("household_members")
      .select(`
        *,
        household:households(type, created_by)
      `)
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      logger.error("[MembersRepository] Error fetching memberships:", error);
      return [];
    }

    return (members || []) as Array<HouseholdMemberRow & { household?: { type: string; created_by: string } }>;
  }

  /**
   * Find pending invitation by email
   */
  async findPendingInvitationByEmail(email: string): Promise<(HouseholdMemberRow & { household?: { created_by: string } | null }) | null> {
    const supabase = await createServerClient();

    const { data: pendingInvitation, error } = await supabase
      .from("household_members")
      .select("id, household_id, email, household:households(created_by)")
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

    return pendingInvitation as (HouseholdMemberRow & { household?: { created_by: string } | null }) | null;
  }

  /**
   * Find households created by a user
   */
  async findHouseholdsByOwner(userId: string): Promise<Array<{ id: string; name: string; type: string; createdBy: string }>> {
    const supabase = await createServerClient();

    const { data: households, error } = await supabase
      .from("households")
      .select("id, name, type, created_by")
      .eq("created_by", userId);

    if (error) {
      logger.error("[MembersRepository] Error fetching households by owner:", error);
      return [];
    }

    return (households || []).map(h => ({
      id: h.id,
      name: h.name,
      type: h.type,
      createdBy: h.created_by,
    }));
  }

  /**
   * Count active members in a household (excluding a specific user)
   */
  async countActiveMembersExcludingUser(householdId: string, excludeUserId: string): Promise<number> {
    const supabase = await createServerClient();

    const { data: members, error } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId)
      .eq("status", "active")
      .neq("user_id", excludeUserId);

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
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId)
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
      .from("system_user_active_households")
      .select("household_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (activeHousehold?.household_id) {
      return activeHousehold.household_id;
    }

    // Fallback to default household
    const { data: defaultMember } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .eq("status", "active")
      .maybeSingle();

    return defaultMember?.household_id || null;
  }
}

