"use server";

import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { Household, HouseholdMember, UserActiveHousehold } from "@/lib/types/household";
import { guardHouseholdMembers, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { sendInvitationEmail } from "@/lib/utils/email";

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
 * Map database HouseholdMember to HouseholdMember type
 */
function mapHouseholdMember(row: any): HouseholdMember {
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
 * Get all households for a user
 */
export async function getUserHouseholds(userId: string): Promise<Household[]> {
  try {
    const supabase = await createServerClient();

    const { data: members, error } = await supabase
      .from("HouseholdMember")
      .select("Household(*)")
      .eq("userId", userId)
      .eq("status", "active");

    if (error) {
      console.error("Error fetching user households:", error);
      return [];
    }

    if (!members) {
      return [];
    }

    return members
      .map((m: any) => m.Household)
      .filter((h: any) => h !== null)
      .map(mapHousehold);
  } catch (error) {
    console.error("Error in getUserHouseholds:", error);
    return [];
  }
}

/**
 * Get the active household for a user
 */
export async function getActiveHousehold(userId: string): Promise<Household | null> {
  try {
    const supabase = await createServerClient();

    // First try to get from UserActiveHousehold
    const { data: activeHousehold, error: activeError } = await supabase
      .from("UserActiveHousehold")
      .select("Household(*)")
      .eq("userId", userId)
      .single();

    if (!activeError && activeHousehold?.Household) {
      return mapHousehold(activeHousehold.Household);
    }

    // Fallback to default (personal) household
    const { data: defaultMember, error: defaultError } = await supabase
      .from("HouseholdMember")
      .select("Household(*)")
      .eq("userId", userId)
      .eq("isDefault", true)
      .eq("status", "active")
      .single();

    if (defaultError || !defaultMember?.Household) {
      return null;
    }

    return mapHousehold(defaultMember.Household);
  } catch (error) {
    console.error("Error in getActiveHousehold:", error);
    return null;
  }
}

/**
 * Set the active household for a user
 */
export async function setActiveHousehold(userId: string, householdId: string): Promise<void> {
  try {
    const supabase = await createServerClient();

    // Verify user is a member of this household
    const { data: member, error: memberError } = await supabase
      .from("HouseholdMember")
      .select("id")
      .eq("householdId", householdId)
      .eq("userId", userId)
      .eq("status", "active")
      .single();

    if (memberError || !member) {
      throw new Error("User is not an active member of this household");
    }

    const now = formatTimestamp(new Date());

    const { error } = await supabase
      .from("UserActiveHousehold")
      .upsert({
        userId,
        householdId,
        updatedAt: now,
      });

    if (error) {
      console.error("Error setting active household:", error);
      throw new Error(`Failed to set active household: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in setActiveHousehold:", error);
    throw error;
  }
}

/**
 * Create a new household (personal or household)
 */
export async function createHousehold(
  userId: string,
  name: string,
  type: 'personal' | 'household'
): Promise<Household> {
  try {
    const supabase = await createServerClient();

    const now = formatTimestamp(new Date());

    // Create household
    const { data: household, error: householdError } = await supabase
      .from("Household")
      .insert({
        name,
        type,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        settings: {},
      })
      .select()
      .single();

    if (householdError || !household) {
      throw new Error(`Failed to create household: ${householdError?.message || 'Unknown error'}`);
    }

    // Create HouseholdMember (owner role)
    const { error: memberError } = await supabase
      .from("HouseholdMember")
      .insert({
        householdId: household.id,
        userId,
        role: 'owner',
        status: 'active',
        isDefault: type === 'personal', // Personal households are default
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      });

    if (memberError) {
      // Rollback: delete the household
      await supabase.from("Household").delete().eq("id", household.id);
      throw new Error(`Failed to create household member: ${memberError.message}`);
    }

    // If personal household, set as active
    if (type === 'personal') {
      await setActiveHousehold(userId, household.id);
    }

    return mapHousehold(household);
  } catch (error) {
    console.error("Error in createHousehold:", error);
    throw error;
  }
}

/**
 * Get all members of a household
 */
export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  try {
    const supabase = await createServerClient();

    // SECURITY: Verify that the current user is actually a member of this household
    // This prevents users from accessing other households by manipulating householdId
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("User not authenticated");
      return [];
    }

    const { data: userMembership, error: membershipError } = await supabase
      .from("HouseholdMember")
      .select("id")
      .eq("householdId", householdId)
      .eq("userId", authUser.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError || !userMembership) {
      console.error("User is not a member of this household:", {
        userId: authUser.id,
        householdId,
        error: membershipError,
      });
      return [];
    }

    const { data: members, error } = await supabase
      .from("HouseholdMember")
      .select("*")
      .eq("householdId", householdId)
      .order("role", { ascending: false }) // owner first, then admin, then member
      .order("createdAt", { ascending: true });

    if (error) {
      console.error("Error fetching household members:", error);
      return [];
    }

    if (!members) {
      return [];
    }

    return members.map(mapHouseholdMember);
  } catch (error) {
    console.error("Error in getHouseholdMembers:", error);
    return [];
  }
}

/**
 * Invite a member to a household
 */
export async function inviteHouseholdMember(
  householdId: string,
  email: string,
  role: 'admin' | 'member' = 'member',
  name?: string
): Promise<HouseholdMember> {
  try {
    const supabase = await createServerClient();

    // Get household info
    const { data: household, error: householdError } = await supabase
      .from("Household")
      .select("id, name, type, createdBy")
      .eq("id", householdId)
      .single();

    if (householdError || !household) {
      throw new Error("Household not found");
    }

    // Check if user has permission (must be owner or admin)
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser?.user) {
      throw new Error("User not authenticated");
    }

    const { data: userMember } = await supabase
      .from("HouseholdMember")
      .select("role")
      .eq("householdId", householdId)
      .eq("userId", currentUser.user.id)
      .eq("status", "active")
      .single();

    if (!userMember || !['owner', 'admin'].includes(userMember.role)) {
      throw new Error("You don't have permission to invite members to this household");
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("User")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    // Check if user is already a member
    if (existingUser) {
      const { data: existingMember } = await supabase
        .from("HouseholdMember")
        .select("id")
        .eq("householdId", householdId)
        .eq("userId", existingUser.id)
        .maybeSingle();

      if (existingMember) {
        throw new Error("User is already a member of this household");
      }
    }

    const invitationToken = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    // For now, we'll create a pending invitation record
    // Note: HouseholdMember doesn't have email field, so we'll need to handle this differently
    // We can create a pending record and link it when user accepts
    // For now, if user exists, create active member; otherwise, we'll need to handle via old HouseholdMember table
    // or create a separate invitation table
    
    // If user exists, create member immediately
    if (existingUser) {
      const { data: member, error: memberError } = await supabase
        .from("HouseholdMember")
        .insert({
          householdId,
          userId: existingUser.id,
          role,
          status: 'active',
          isDefault: false,
          joinedAt: now,
          invitedBy: currentUser.user.id,
          createdAt: now,
          updatedAt: now,
        })
        .select()
        .single();

      if (memberError || !member) {
        throw new Error(`Failed to invite member: ${memberError?.message || 'Unknown error'}`);
      }

      return mapHouseholdMember(member);
    } else {
      // User doesn't exist - we'll need to use the old HouseholdMember table for invitations
      // or create a separate invitation mechanism
      // For now, throw error - invitations for non-users should go through old system
      throw new Error("User not found. Please use the existing invitation system for new users.");
    }
  } catch (error) {
    console.error("Error in inviteHouseholdMember:", error);
    throw error;
  }
}

/**
 * Update a member's role
 */
export async function updateHouseholdMemberRole(
  householdId: string,
  memberId: string,
  role: 'owner' | 'admin' | 'member'
): Promise<HouseholdMember> {
  try {
    const supabase = await createServerClient();

    // Check permissions
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser?.user) {
      throw new Error("User not authenticated");
    }

    const { data: userMember } = await supabase
      .from("HouseholdMember")
      .select("role")
      .eq("householdId", householdId)
      .eq("userId", currentUser.user.id)
      .eq("status", "active")
      .single();

    if (!userMember || userMember.role !== 'owner') {
      throw new Error("Only household owners can update member roles");
    }

    const now = formatTimestamp(new Date());

    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .update({
        role,
        updatedAt: now,
      })
      .eq("id", memberId)
      .eq("householdId", householdId)
      .select()
      .single();

    if (error || !member) {
      throw new Error(`Failed to update member role: ${error?.message || 'Unknown error'}`);
    }

    return mapHouseholdMember(member);
  } catch (error) {
    console.error("Error in updateHouseholdMemberRole:", error);
    throw error;
  }
}

/**
 * Remove a member from a household
 */
export async function removeHouseholdMember(householdId: string, memberId: string): Promise<void> {
  try {
    const supabase = await createServerClient();

    // Check permissions
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser?.user) {
      throw new Error("User not authenticated");
    }

    const { data: userMember } = await supabase
      .from("HouseholdMember")
      .select("role")
      .eq("householdId", householdId)
      .eq("userId", currentUser.user.id)
      .eq("status", "active")
      .single();

    // Allow if user is owner/admin, or if user is removing themselves
    const isRemovingSelf = memberId === currentUser.user.id;
    if (!userMember || (!['owner', 'admin'].includes(userMember.role) && !isRemovingSelf)) {
      throw new Error("You don't have permission to remove members from this household");
    }

    // Don't allow removing the last owner
    if (userMember.role === 'owner' && !isRemovingSelf) {
      const { data: owners } = await supabase
        .from("HouseholdMember")
        .select("id")
        .eq("householdId", householdId)
        .eq("role", "owner")
        .eq("status", "active");

      if (owners && owners.length <= 1) {
        throw new Error("Cannot remove the last owner of the household");
      }
    }

    const { error } = await supabase
      .from("HouseholdMember")
      .delete()
      .eq("id", memberId)
      .eq("householdId", householdId);

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in removeHouseholdMember:", error);
    throw error;
  }
}

/**
 * Get household by ID
 */
export async function getHousehold(householdId: string): Promise<Household | null> {
  try {
    const supabase = await createServerClient();

    const { data: household, error } = await supabase
      .from("Household")
      .select("*")
      .eq("id", householdId)
      .single();

    if (error || !household) {
      return null;
    }

    return mapHousehold(household);
  } catch (error) {
    console.error("Error in getHousehold:", error);
    return null;
  }
}

