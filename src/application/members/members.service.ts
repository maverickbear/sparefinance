/**
 * Members Service
 * Business logic for household member management
 */

import { MembersRepository } from "@/src/infrastructure/database/repositories/members.repository";
import { MembersMapper } from "./members.mapper";
import { MemberInviteFormData, MemberUpdateFormData } from "../../domain/members/members.validations";
import { BaseHouseholdMember, UserHouseholdInfo } from "../../domain/members/members.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { guardHouseholdMembers, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { logger } from "@/src/infrastructure/utils/logger";
import { sendInvitationEmail } from "@/lib/utils/email";

export class MembersService {
  constructor(private repository: MembersRepository) {}

  /**
   * Check if user has access to household members feature
   */
  async checkMemberAccess(userId: string): Promise<boolean> {
    try {
      const guard = await guardHouseholdMembers(userId);
      return guard.allowed;
    } catch (error) {
      logger.error("Error checking member access:", error);
      return false;
    }
  }

  /**
   * Get all household members
   */
  async getHouseholdMembers(ownerId: string): Promise<BaseHouseholdMember[]> {
    try {
      const supabase = await createServerClient();

      // Get owner information
      const { data: ownerData } = await supabase
        .from("User")
        .select("id, email, name, role, createdAt, updatedAt")
        .eq("id", ownerId)
        .single();

      // Get the owner's active household
      const householdId = await getActiveHouseholdId(ownerId);
      
      if (!householdId) {
        logger.error("No household found for owner:", ownerId);
        // Fallback: return owner as only member
        if (ownerData) {
          return [{
            id: ownerData.id,
            ownerId: ownerData.id,
            memberId: ownerData.id,
            email: ownerData.email,
            name: ownerData.name || null,
            role: "admin",
            status: "active",
            invitationToken: "",
            invitedAt: ownerData.createdAt,
            acceptedAt: ownerData.createdAt,
            createdAt: ownerData.createdAt,
            updatedAt: ownerData.updatedAt,
            isOwner: true,
          }];
        }
        return [];
      }

      // Get household members
      const memberRows = await this.repository.findAllByHousehold(householdId);

      // Fetch user data for members
      const userIds = memberRows
        .map(m => m.userId)
        .filter((id): id is string => id !== null);

      const usersMap = new Map<string, { id: string; email: string; name: string | null; avatarUrl: string | null }>();
      
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("User")
          .select("id, email, name, avatarUrl")
          .in("id", userIds);

        users?.forEach(user => {
          usersMap.set(user.id, user);
        });
      }

      // Map to domain entities
      const members: BaseHouseholdMember[] = memberRows.map(row => {
        const user = row.userId ? usersMap.get(row.userId) : null;
        return MembersMapper.toDomain(row, ownerId, user);
      });

      // Sort to ensure owner appears first
      members.sort((a, b) => {
        if (a.isOwner && !b.isOwner) return -1;
        if (!a.isOwner && b.isOwner) return 1;
        return 0;
      });

      return members;
    } catch (error) {
      logger.error("Error in getHouseholdMembers:", error);
      return [];
    }
  }

  /**
   * Invite a new member
   */
  async inviteMember(ownerId: string, data: MemberInviteFormData): Promise<BaseHouseholdMember> {
    const supabase = await createServerClient();

    // Check if member access is allowed
    const guard = await guardHouseholdMembers(ownerId);
    await throwIfNotAllowed(guard);

    // Get the owner's active household
    const householdId = await getActiveHouseholdId(ownerId);
    if (!householdId) {
      throw new Error("No household found for owner");
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("User")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();

    // Check if member already exists
    if (existingUser) {
      const existingMember = await this.repository.findByUserIdAndHousehold(existingUser.id, householdId);
      if (existingMember) {
        throw new Error("User is already a member of this household");
      }
    } else {
      // Check for pending invitation
      const existingPending = await this.repository.findByEmailAndHousehold(data.email, householdId);
      if (existingPending && existingPending.status === "pending") {
        throw new Error("Member with this email has already been invited");
      }
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    // Get current user for invitedBy
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    // Create member
    const id = crypto.randomUUID();
    const memberRow = await this.repository.create({
      id,
      householdId,
      userId: existingUser?.id || null,
      email: existingUser ? null : data.email.toLowerCase(),
      name: data.name || null,
      role: data.role === 'admin' ? 'admin' : 'member',
      status: existingUser ? "active" : "pending",
      invitationToken: existingUser ? null : invitationToken,
      invitedAt: now,
      acceptedAt: existingUser ? now : null,
      joinedAt: now,
      invitedBy: currentUser.id,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });

    // If user already exists, return immediately
    if (existingUser) {
      const { data: user } = await supabase
        .from("User")
        .select("id, email, name, avatarUrl")
        .eq("id", existingUser.id)
        .single();

      return MembersMapper.toDomain(memberRow, ownerId, user);
    }

    // Send invitation email
    try {
      const { data: owner } = await supabase
        .from("User")
        .select("name, email")
        .eq("id", ownerId)
        .single();

      if (owner) {
        await sendInvitationEmail({
          to: data.email.toLowerCase(),
          memberName: data.name || data.email,
          ownerName: owner.name || owner.email || "A user",
          ownerEmail: owner.email,
          invitationToken,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        logger.log("[MembersService] ✅ Invitation email sent successfully");
      }
    } catch (emailError) {
      logger.error("[MembersService] ❌ Error sending invitation email:", emailError);
      // Don't fail the invitation if email fails
    }

    return MembersMapper.toDomain(memberRow, ownerId, null);
  }

  /**
   * Update a member
   */
  async updateMember(memberId: string, data: MemberUpdateFormData): Promise<BaseHouseholdMember> {
    const supabase = await createServerClient();

    // Get current member
    const currentMember = await this.repository.findById(memberId);
    if (!currentMember) {
      throw new Error("Member not found");
    }

    const now = formatTimestamp(new Date());
    const updateData: any = {
      updatedAt: now,
    };

    // Update name
    if (data.name !== undefined) {
      if (currentMember.status === 'pending') {
        updateData.name = data.name || null;
      } else if (currentMember.userId) {
        // Update User table for active members
        await supabase
          .from("User")
          .update({ name: data.name || null, updatedAt: now })
          .eq("id", currentMember.userId);
      }
    }

    // Update email
    if (data.email !== undefined) {
      const currentEmail = currentMember.email || "";
      if (data.email.toLowerCase() !== currentEmail.toLowerCase()) {
        // Check if email is already used
        const { data: existingUser } = await supabase
          .from("User")
          .select("id")
          .eq("email", data.email.toLowerCase())
          .maybeSingle();

        if (existingUser) {
          const existingMember = await this.repository.findByUserIdAndHousehold(
            existingUser.id,
            currentMember.householdId
          );
          if (existingMember && existingMember.id !== memberId) {
            throw new Error("Email is already used by another member");
          }
        }

        if (currentMember.status === 'pending') {
          updateData.email = data.email.toLowerCase();
          // Generate new token and resend invitation
          const newToken = crypto.randomUUID();
          updateData.invitationToken = newToken;
          updateData.invitedAt = now;
        } else if (currentMember.userId) {
          // Update User table
          await supabase
            .from("User")
            .update({ email: data.email.toLowerCase(), updatedAt: now })
            .eq("id", currentMember.userId);
        }
      }
    }

    // Update role
    if (data.role !== undefined) {
      updateData.role = data.role === 'admin' ? 'admin' : 'member';
    }

    const updatedMember = await this.repository.update(memberId, updateData);

    // Get household owner
    const { data: household } = await supabase
      .from("Household")
      .select("createdBy")
      .eq("id", currentMember.householdId)
      .single();

    // Get user data
    const user = updatedMember.userId ? await supabase
      .from("User")
      .select("id, email, name, avatarUrl")
      .eq("id", updatedMember.userId)
      .single()
      .then(r => r.data) : null;

    return MembersMapper.toDomain(updatedMember, household?.createdBy || "", user);
  }

  /**
   * Remove a member
   */
  async removeMember(memberId: string): Promise<void> {
    const supabase = await createServerClient();

    // Get member info before deleting
    const member = await this.repository.findById(memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    // If member has userId, create personal household if needed
    if (member.userId) {
      const { data: existingPersonalHousehold } = await supabase
        .from("HouseholdMemberNew")
        .select("householdId, Household(type)")
        .eq("userId", member.userId)
        .eq("isDefault", true)
        .maybeSingle();

      if (!existingPersonalHousehold) {
        const { createHousehold } = await import("@/lib/api/households");
        try {
          const { data: user } = await supabase
            .from("User")
            .select("name, email")
            .eq("id", member.userId)
            .single();

          await createHousehold(
            member.userId,
            user?.name || user?.email || "Minha Conta",
            'personal'
          );
        } catch (createError) {
          logger.error("Error creating personal household for removed member:", createError);
        }
      }
    }

    await this.repository.delete(memberId);
  }

  /**
   * Resend invitation email
   */
  async resendInvitationEmail(memberId: string): Promise<void> {
    const supabase = await createServerClient();

    const member = await this.repository.findById(memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    if (member.status !== "pending") {
      throw new Error("Can only resend invitation for pending members");
    }

    if (!member.invitationToken || !member.email) {
      throw new Error("Invalid invitation: missing token or email");
    }

    // Get household owner
    const { data: household } = await supabase
      .from("Household")
      .select("createdBy")
      .eq("id", member.householdId)
      .single();

    const { data: owner } = await supabase
      .from("User")
      .select("name, email")
      .eq("id", household?.createdBy)
      .single();

    if (!owner) {
      throw new Error("Owner not found");
    }

    // Send invitation email
    await sendInvitationEmail({
      to: member.email,
      memberName: member.name || member.email,
      ownerName: owner.name || owner.email || "A user",
      ownerEmail: owner.email,
      invitationToken: member.invitationToken,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
  }

  /**
   * Accept invitation (for authenticated users)
   */
  async acceptInvitation(token: string, userId: string): Promise<BaseHouseholdMember> {
    const supabase = await createServerClient();

    // Find invitation
    const invitation = await this.repository.findByInvitationToken(token);
    if (!invitation) {
      throw new Error("Invalid or expired invitation token");
    }

    // Verify user email matches
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error("User not authenticated");
    }

    if (invitation.email && authUser.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("Email does not match the invitation");
    }

    const now = formatTimestamp(new Date());

    // Update invitation to active
    const updatedMember = await this.repository.update(invitation.id, {
      userId,
      status: "active",
      acceptedAt: now,
      email: null,
      name: null,
      invitationToken: null,
      updatedAt: now,
    });

    // Set active household
    await supabase
      .from("UserActiveHousehold")
      .upsert({
        userId,
        householdId: invitation.householdId,
        updatedAt: now,
      }, {
        onConflict: "userId"
      });

    // Get household owner
    const { data: household } = await supabase
      .from("Household")
      .select("createdBy")
      .eq("id", invitation.householdId)
      .single();

    // Get user data
    const { data: user } = await supabase
      .from("User")
      .select("id, email, name, avatarUrl")
      .eq("id", userId)
      .single();

    return MembersMapper.toDomain(updatedMember, household?.createdBy || "", user);
  }

  /**
   * Get user household info
   */
  async getUserHouseholdInfo(userId: string): Promise<UserHouseholdInfo | null> {
    try {
      const supabase = await createServerClient();
      
      // Check if user is an owner
      const { data: ownedHousehold } = await supabase
        .from("Household")
        .select("id, type")
        .eq("createdBy", userId)
        .limit(1)
        .maybeSingle();

      const isOwner = ownedHousehold !== null;

      // Check if user is a member
      const memberships = await this.repository.findActiveMembershipsByUserId(userId);
      const isMember = memberships.some(m => {
        const household = m.household;
        return household && household.type !== 'personal' && household.createdBy !== userId;
      });

      if (!isOwner && !isMember) {
        return {
          isOwner: false,
          isMember: false,
        };
      }

      if (isOwner) {
        return {
          isOwner: true,
          isMember: false,
        };
      }

      // User is a member, get owner info
      const membership = memberships.find(m => {
        const household = m.household;
        return household && household.type !== 'personal' && household.createdBy !== userId;
      });

      if (membership?.household) {
        const ownerId = membership.household.createdBy;
        const { data: owner } = await supabase
          .from("User")
          .select("name, email")
          .eq("id", ownerId)
          .maybeSingle();

        return {
          isOwner: false,
          isMember: true,
          ownerId,
          ownerName: owner?.name || owner?.email || undefined,
        };
      }

      return {
        isOwner: false,
        isMember: true,
      };
    } catch (error) {
      logger.error("[MembersService] Error in getUserHouseholdInfo:", error);
      return {
        isOwner: false,
        isMember: false,
      };
    }
  }
}

