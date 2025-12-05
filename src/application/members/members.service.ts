/**
 * Members Service
 * Business logic for household member management
 */

import { MembersRepository } from "@/src/infrastructure/database/repositories/members.repository";
import { HouseholdRepository } from "@/src/infrastructure/database/repositories/household.repository";
import { MembersMapper } from "./members.mapper";
import { MemberInviteFormData, MemberUpdateFormData } from "../../domain/members/members.validations";
import { BaseHouseholdMember, UserHouseholdInfo } from "../../domain/members/members.types";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { guardHouseholdMembers, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { logger } from "@/src/infrastructure/utils/logger";
import { sendInvitationEmail } from "@/lib/utils/email";
import { AppError } from "../shared/app-error";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";

export class MembersService {
  constructor(
    private repository: MembersRepository,
    private householdRepository: HouseholdRepository
  ) {}

  /**
   * Create a new household (personal or household)
   */
  async createHousehold(
    userId: string,
    name: string,
    type: 'personal' | 'household'
  ): Promise<{ id: string; name: string; type: string; createdAt: Date; updatedAt: Date; createdBy: string; settings: Record<string, unknown> }> {
    const now = formatTimestamp(new Date());

    // Create household
    const household = await this.householdRepository.create({
      name,
      type,
      createdBy: userId,
    });

    // Create HouseholdMember (owner role)
    try {
      await this.repository.create({
        id: crypto.randomUUID(),
        householdId: household.id,
        userId,
        email: null,
        name: null,
        role: 'owner',
        status: 'active',
        invitationToken: null,
        invitedAt: now,
        acceptedAt: now,
        joinedAt: now,
        invitedBy: userId,
        isDefault: type === 'personal', // Personal households are default
        createdAt: now,
        updatedAt: now,
      });
    } catch (memberError) {
      // Rollback: delete the household
      await this.householdRepository.delete(household.id);
      throw new AppError(
        `Failed to create household member: ${memberError instanceof Error ? memberError.message : "Unknown error"}`,
        500
      );
    }

    // If personal household, set as active
    if (type === 'personal') {
      try {
        await this.householdRepository.setActiveHousehold(userId, household.id);
      } catch (activeError) {
        logger.warn("Error setting active household (non-critical):", activeError);
        // Don't throw - household is created successfully
      }
    }

    return {
      id: household.id,
      name: household.name,
      type: household.type,
      createdAt: new Date(household.createdAt),
      updatedAt: new Date(household.updatedAt),
      createdBy: household.createdBy,
      settings: household.settings || {},
    };
  }

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
   * Get active household ID for user
   */
  async getActiveHouseholdId(userId: string): Promise<string | null> {
    return this.repository.getActiveHouseholdId(userId);
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
      const householdId = await this.getActiveHouseholdId(ownerId);
      
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
    const householdId = await this.getActiveHouseholdId(ownerId);
    if (!householdId) {
      throw new AppError("No household found for owner", 400);
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
        throw new AppError("User is already a member of this household", 400);
      }
    } else {
      // Check for pending invitation
      const existingPending = await this.repository.findByEmailAndHousehold(data.email, householdId);
      if (existingPending && existingPending.status === "pending") {
        throw new AppError("Member with this email has already been invited", 400);
      }
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    // Get current user for invitedBy
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new AppError("User not authenticated", 401);
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
      throw new AppError("Member not found", 404);
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
            throw new AppError("Email is already used by another member", 400);
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
      throw new AppError("Member not found", 404);
    }

    // If member has userId, create personal household if needed
    if (member.userId) {
      const { data: existingPersonalHousehold } = await supabase
        .from("HouseholdMember")
        .select("householdId, Household(type)")
        .eq("userId", member.userId)
        .eq("isDefault", true)
        .maybeSingle();

      if (!existingPersonalHousehold) {
        try {
          const { data: user } = await supabase
            .from("User")
            .select("name, email")
            .eq("id", member.userId)
            .single();

          await this.createHousehold(
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
      throw new AppError("Member not found", 404);
    }

    if (member.status !== "pending") {
      throw new AppError("Can only resend invitation for pending members", 400);
    }

    if (!member.invitationToken || !member.email) {
      throw new AppError("Invalid invitation: missing token or email", 400);
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
      throw new AppError("Owner not found", 404);
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
      throw new AppError("Invalid or expired invitation token", 400);
    }

    // Verify user email matches
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new AppError("User not authenticated", 401);
    }

    if (invitation.email && authUser.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AppError("Email does not match the invitation", 400);
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

    // Invalidate subscription cache to ensure household subscription is found
    // This is critical for household members who should inherit the owner's subscription
    try {
      const { makeSubscriptionsService } = await import("../subscriptions/subscriptions.factory");
      const subscriptionsService = makeSubscriptionsService();
      subscriptionsService.invalidateSubscriptionCache(userId);
      logger.debug("[MembersService] Invalidated subscription cache for new household member", { userId, householdId: invitation.householdId });
      
      // Check if member has personal subscription and household has subscription
      // If both exist, pause member's personal subscription
      try {
        // Import repository to check subscriptions directly
        const { SubscriptionsRepository } = await import("@/src/infrastructure/database/repositories/subscriptions.repository");
        const subscriptionsRepository = new SubscriptionsRepository();
        
        // Check if member has personal subscription (by userId, not householdId)
        const memberPersonalSubscription = await subscriptionsRepository.findByUserId(userId);
        
        // Check if household has subscription
        const householdSubscription = await subscriptionsRepository.findByHouseholdId(invitation.householdId);
        
        if (memberPersonalSubscription && 
            (memberPersonalSubscription.status === "active" || memberPersonalSubscription.status === "trialing") &&
            householdSubscription &&
            (householdSubscription.status === "active" || householdSubscription.status === "trialing")) {
          // Both have active subscriptions - pause member's personal subscription
          logger.log("[MembersService] Both member and household have active subscriptions, pausing member's subscription", {
            userId,
            householdId: invitation.householdId,
            memberSubscriptionId: memberPersonalSubscription.id,
            householdSubscriptionId: householdSubscription.id,
          });
          
          const pauseResult = await subscriptionsService.pauseUserSubscription(
            userId,
            "household_member",
            {
              pausedByHouseholdId: invitation.householdId,
            }
          );
          
          if (pauseResult.paused) {
            logger.log("[MembersService] Successfully paused member's personal subscription", {
              userId,
              householdId: invitation.householdId,
            });
          } else {
            logger.warn("[MembersService] Failed to pause member's personal subscription", {
              userId,
              householdId: invitation.householdId,
              error: pauseResult.error,
            });
            // Don't fail invitation acceptance if pause fails
          }
        }
      } catch (pauseError) {
        logger.warn("[MembersService] Error checking/pausing subscriptions during invitation acceptance:", pauseError);
        // Don't fail invitation acceptance if pause check fails
      }
    } catch (cacheError) {
      logger.warn("[MembersService] Could not invalidate subscription cache after accepting invitation:", cacheError);
      // Don't fail the invitation acceptance if cache invalidation fails
    }

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

  /**
   * Get user role (admin, member, or super_admin)
   * Optimized version that checks User role and household memberships
   */
  async getUserRole(userId: string): Promise<"admin" | "member" | "super_admin" | null> {
    try {
      const supabase = await createServerClient();
      
      // Fetch User role and HouseholdMember in parallel
      const [userResult, householdResult] = await Promise.all([
        supabase
          .from("User")
          .select("role")
          .eq("id", userId)
          .single(),
        // Get user's household memberships
        supabase
          .from("HouseholdMember")
          .select("role, userId, status, Household(type, createdBy)")
          .eq("userId", userId)
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
          return household?.createdBy === userId && household?.type !== 'personal';
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
          return household?.createdBy !== userId;
        }
      );
      
      if (activeMember) {
        return "member";
      }

      // Default: user is owner of their personal household (admin)
      return "admin";
    } catch (error) {
      logger.error("[MembersService] Error getting user role:", error);
      return null;
    }
  }

  /**
   * Validate invitation token
   * Returns invitation data if valid, null otherwise
   */
  async validateInvitationToken(token: string): Promise<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    owner_id: string;
  } | null> {
    const supabase = await createServerClient();

    const { data: invitationData, error } = await supabase
      .rpc("validate_invitation_token", { p_token: token });

    if (error || !invitationData || invitationData.length === 0) {
      return null;
    }

    return invitationData[0];
  }

  /**
   * Get owner information for invitation
   */
  async getOwnerInfoForInvitation(ownerId: string): Promise<{
    name: string | null;
    email: string;
  } | null> {
    const supabase = await createServerClient();

    const { data: ownerData, error } = await supabase
      .rpc("get_owner_info_for_invitation", { p_owner_id: ownerId });

    if (error || !ownerData || ownerData.length === 0) {
      logger.error("[MembersService] Error fetching owner info:", error);
      return null;
    }

    return ownerData[0];
  }

  /**
   * Check if email has an account
   */
  async checkEmailHasAccount(email: string): Promise<boolean> {
    const supabase = await createServerClient();

    const { data: hasAccount, error } = await supabase
      .rpc("check_email_has_account", { p_email: email });

    if (error) {
      logger.error("[MembersService] Error checking email:", error);
      return false;
    }

    return hasAccount === true;
  }

  /**
   * Accept invitation with password (for new users)
   * Creates user account and returns invitation info
   */
  async acceptInvitationWithPassword(
    token: string,
    password: string
  ): Promise<{
    member: BaseHouseholdMember | null;
    session: any;
    requiresOtpVerification?: boolean;
    email?: string;
    invitationId?: string;
    userId?: string;
  }> {
    // First, validate the token
    const supabase = await createServerClient();
    
    const invitationData = await this.validateInvitationToken(token);
    if (!invitationData) {
      throw new AppError("Invalid or expired invitation token", 400);
    }

    // Get full invitation details using service role (needed for creating account)
    const serviceRoleClient = createServiceRoleClient();
    
    const { data: fullInvitation, error: findError } = await serviceRoleClient
      .from("HouseholdMember")
      .select(`
        *,
        Household(createdBy, id)
      `)
      .eq("id", invitationData.id)
      .eq("status", "pending")
      .single();

    if (findError || !fullInvitation) {
      throw new AppError("Invalid or expired invitation token", 400);
    }

    if (!fullInvitation.email) {
      throw new AppError("Invitation is missing email", 400);
    }

    // Check password against HIBP
    const passwordValidation = await validatePasswordAgainstHIBP(password);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.error || "Invalid password", 400);
    }

    // Create user in Supabase Auth using service role client
    const { data: authData, error: authError } = await serviceRoleClient.auth.signUp({
      email: fullInvitation.email,
      password: password,
      options: {
        emailRedirectTo: undefined, // Don't require email confirmation
        data: {
          name: fullInvitation.name || "",
        },
      },
    });

    if (authError) {
      const errorMessage = getAuthErrorMessage(authError, "Failed to create account");
      throw new AppError(errorMessage, 400);
    }

    if (!authData.user) {
      throw new AppError("Failed to create account. Please try again.", 400);
    }

    const userId = authData.user.id;
    const now = formatTimestamp(new Date());

    // Send OTP email for verification
    logger.log("[MembersService] Sending OTP email for invitation acceptance");
    const { error: otpError } = await serviceRoleClient.auth.resend({
      type: "signup",
      email: fullInvitation.email,
    });

    if (otpError) {
      logger.error("[MembersService] Error sending OTP:", otpError);
      // Continue anyway - OTP might have been sent automatically by Supabase
    } else {
      logger.log("[MembersService] ✅ OTP email sent successfully");
    }

    // Create User in User table using service role (bypasses RLS during account creation)
    const { error: createUserError } = await serviceRoleClient
      .from("User")
      .insert({
        id: userId,
        email: fullInvitation.email,
        name: fullInvitation.name || null,
        role: fullInvitation.role || "member",
        createdAt: now,
        updatedAt: now,
      });

    if (createUserError) {
      logger.error("[MembersService] Error creating user:", createUserError);
      throw new AppError(`Failed to create user: ${createUserError.message}`, 400);
    }

    // Return without session - user needs to verify OTP first
    return {
      member: null, // Will be set after OTP verification
      session: null, // No session until OTP is verified
      requiresOtpVerification: true,
      email: fullInvitation.email,
      invitationId: fullInvitation.id,
      userId: userId,
    };
  }

  /**
   * Complete invitation acceptance after OTP verification
   */
  async completeInvitationAfterOtp(
    userId: string,
    invitationId: string
  ): Promise<{ member: BaseHouseholdMember; session: any }> {
    const serviceRoleClient = createServiceRoleClient();
    const now = formatTimestamp(new Date());

    // Get the invitation to verify it's still pending
    const { data: invitation, error: findError } = await serviceRoleClient
      .from("HouseholdMember")
      .select(`
        *,
        Household(createdBy, id)
      `)
      .eq("id", invitationId)
      .eq("status", "pending")
      .single();

    if (findError || !invitation) {
      throw new AppError("Invitation not found or already accepted", 400);
    }

    // Verify the userId matches the invitation email
    const { data: userData } = await serviceRoleClient
      .from("User")
      .select("email")
      .eq("id", userId)
      .single();

    if (!userData || (invitation.email && userData.email.toLowerCase() !== invitation.email.toLowerCase())) {
      throw new AppError("User email does not match invitation", 400);
    }

    // Update the invitation to active status and link the member
    // Use service role client to bypass RLS during invitation acceptance
    const { data: updatedMemberRow, error: updateError } = await serviceRoleClient
      .from("HouseholdMember")
      .update({
        userId: userId,
        status: "active",
        acceptedAt: now,
        joinedAt: now, // Set joinedAt when accepting
        email: null, // Clear email now that user is linked
        name: null, // Clear name now that user is linked
        invitationToken: null, // Clear token
        updatedAt: now,
      })
      .eq("id", invitationId)
      .eq("status", "pending") // Double-check it's still pending
      .select()
      .single();

    if (updateError || !updatedMemberRow) {
      logger.error("[MembersService] Error updating member in completeInvitationAfterOtp:", updateError);
      throw new AppError(
        `Failed to update member: ${updateError?.message || "No rows updated"}`,
        500
      );
    }

    const household = invitation.Household as any;
    logger.log("[MembersService] completeInvitationAfterOtp - Member accepted invitation:", {
      memberId: updatedMemberRow.userId,
      userId,
      householdId: updatedMemberRow.householdId,
      status: updatedMemberRow.status,
    });

    // Set the household as active for the new member
    try {
      const { error: activeError } = await serviceRoleClient
        .from("UserActiveHousehold")
        .upsert({
          userId: userId,
          householdId: updatedMemberRow.householdId,
          updatedAt: now,
        }, {
          onConflict: "userId"
        });
      
      if (activeError) {
        logger.warn("[MembersService] Could not set active household for new member:", activeError);
      } else {
        logger.log("[MembersService] Set active household for new member:", { userId, householdId: updatedMemberRow.householdId });
      }
    } catch (activeError) {
      logger.warn("[MembersService] Error setting active household:", activeError);
    }

    // Update subscription cache in User table for the new member
    try {
      const { error: cacheUpdateError } = await serviceRoleClient.rpc(
        "update_user_subscription_cache",
        { p_user_id: userId }
      );
      
      if (cacheUpdateError) {
        logger.warn("[MembersService] Could not update subscription cache via RPC:", cacheUpdateError);
        // Fallback: invalidate cache
        try {
          const { makeSubscriptionsService } = await import("../subscriptions/subscriptions.factory");
          const subscriptionsService = makeSubscriptionsService();
          subscriptionsService.invalidateSubscriptionCache(userId);
        } catch (invalidateError) {
          logger.warn("[MembersService] Could not invalidate subscription cache:", invalidateError);
        }
      } else {
        logger.log("[MembersService] Subscription cache updated in User table for new member");
      }
    } catch (cacheError) {
      logger.warn("[MembersService] Could not update subscription cache:", cacheError);
      // Fallback: invalidate cache
      try {
        const { makeSubscriptionsService } = await import("../subscriptions/subscriptions.factory");
        const subscriptionsService = makeSubscriptionsService();
        subscriptionsService.invalidateSubscriptionCache(userId);
      } catch (invalidateError) {
        logger.warn("[MembersService] Could not invalidate subscription cache:", invalidateError);
      }
    }

    // Get session for the authenticated user
    const supabase = await createServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      logger.warn("[MembersService] Could not get session:", sessionError);
    }

    // Get user data
    const { data: user } = await supabase
      .from("User")
      .select("id, email, name, avatarUrl")
      .eq("id", userId)
      .single();

    const member = MembersMapper.toDomain(updatedMemberRow, household?.createdBy || "", user);

    return {
      member,
      session: session || null,
    };
  }

  /**
   * Create household member (deprecated - use createHousehold instead)
   * Kept for backward compatibility with old API routes
   */
  async createHouseholdMember(data: {
    ownerId: string;
    memberId?: string;
    email: string;
    name?: string;
  }): Promise<{ id: string; householdId: string }> {
    // Get or create household for owner
    let householdId = await this.getActiveHouseholdId(data.ownerId);
    
    if (!householdId) {
      // Create personal household for owner
      const household = await this.createHousehold(data.ownerId, "Personal", "personal");
      householdId = household.id;
    }

    // Check if member already exists
    if (data.memberId) {
      const existing = await this.repository.findByUserIdAndHousehold(data.memberId, householdId);
      if (existing) {
        return { id: existing.id, householdId };
      }
    }

    // Create member record
    const now = formatTimestamp(new Date());
    const id = crypto.randomUUID();
    const memberRow = await this.repository.create({
      id,
      householdId,
      userId: data.memberId || null,
      email: data.memberId ? null : data.email.toLowerCase(),
      name: data.name || null,
      role: "member",
      status: data.memberId ? "active" : "pending",
      invitationToken: data.memberId ? null : crypto.randomUUID(),
      invitedAt: now,
      acceptedAt: data.memberId ? now : null,
      joinedAt: now,
      invitedBy: data.ownerId,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });

    return { id: memberRow.id, householdId };
  }

  /**
   * Check if an email has a pending invitation
   */
  async checkPendingInvitation(email: string): Promise<{ hasPendingInvitation: boolean }> {
    const pendingInvitation = await this.repository.findPendingInvitationByEmail(email);
    return { hasPendingInvitation: !!pendingInvitation };
  }

  /**
   * Check if user is owner of a household with other members
   * Returns true if user owns a household (non-personal or personal with other members)
   */
  async checkHouseholdOwnership(userId: string): Promise<{
    isOwner: boolean;
    householdId: string | null;
    memberCount: number;
    householdName: string | null;
  }> {
    try {
      // Get all households created by this user
      const ownedHouseholds = await this.repository.findHouseholdsByOwner(userId);

      if (!ownedHouseholds || ownedHouseholds.length === 0) {
        return { isOwner: false, householdId: null, memberCount: 0, householdName: null };
      }

      // Check each household for other members
      for (const household of ownedHouseholds) {
        // For personal households, check if there are other members
        if (household.type === "personal") {
          const otherMemberCount = await this.repository.countActiveMembersExcludingUser(household.id, userId);

          // If personal household has other members, user is owner of shared household
          if (otherMemberCount > 0) {
            return {
              isOwner: true,
              householdId: household.id,
              memberCount: otherMemberCount + 1, // +1 for the owner
              householdName: household.name,
            };
          }
        } else {
          // Non-personal household - user is definitely an owner
          const memberCount = await this.repository.countActiveMembers(household.id);
          return {
            isOwner: true,
            householdId: household.id,
            memberCount,
            householdName: household.name,
          };
        }
      }

      return { isOwner: false, householdId: null, memberCount: 0, householdName: null };
    } catch (error) {
      logger.error("[MembersService] Error checking household ownership:", error);
      return { isOwner: false, householdId: null, memberCount: 0, householdName: null };
    }
  }
}

