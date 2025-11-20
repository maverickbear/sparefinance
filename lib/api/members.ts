"use server";

import { createServerClient, createServiceRoleClient } from "@/lib/supabase-server";
import { MemberInviteFormData, MemberUpdateFormData } from "@/lib/validations/member";
import { formatTimestamp } from "@/lib/utils/timestamp";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
// checkPlanLimits removed - not used in this file
import { sendInvitationEmail } from "@/lib/utils/email";
import { guardHouseholdMembers, throwIfNotAllowed } from "@/lib/api/feature-guard";
import { getActiveHouseholdId } from "@/lib/utils/household";

export interface HouseholdMember {
  id: string;
  ownerId: string;
  memberId: string | null;
  email: string;
  name: string | null;
  role: "admin" | "member";
  status: "pending" | "active" | "declined";
  invitationToken: string;
  invitedAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isOwner?: boolean; // Flag to indicate if this is the account owner
}

// Check if user has access to household members feature
export async function checkMemberAccess(userId: string): Promise<boolean> {
  try {
    const guard = await guardHouseholdMembers(userId);
    return guard.allowed;
  } catch (error) {
    console.error("Error checking member access:", error);
    return false;
  }
}

export async function getHouseholdMembers(ownerId: string): Promise<HouseholdMember[]> {
  try {
    const supabase = await createServerClient();

    // Get owner information
    const { data: ownerData, error: ownerError } = await supabase
      .from("User")
      .select("id, email, name, role, createdAt, updatedAt")
      .eq("id", ownerId)
      .single();

    // Get the owner's active household (or default personal household)
    const householdId = await getActiveHouseholdId(ownerId);
    
    if (!householdId) {
      console.error("No household found for owner:", ownerId);
      // Fallback: return owner as only member
      if (ownerData && !ownerError) {
        return [{
          id: ownerData.id,
          ownerId: ownerData.id,
          memberId: ownerData.id,
          email: ownerData.email,
          name: ownerData.name || null,
          role: "admin",
          status: "active",
          invitationToken: "",
          invitedAt: new Date(ownerData.createdAt),
          acceptedAt: new Date(ownerData.createdAt),
          createdAt: new Date(ownerData.createdAt),
          updatedAt: new Date(ownerData.updatedAt),
          isOwner: true,
        }];
      }
      return [];
    }

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
    const householdMembers: HouseholdMember[] = (members || []).map(member => {
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
        invitedAt: member.invitedAt ? new Date(member.invitedAt) : new Date(member.createdAt),
        acceptedAt: member.acceptedAt ? new Date(member.acceptedAt) : null,
        createdAt: new Date(member.createdAt),
        updatedAt: new Date(member.updatedAt),
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
  } catch (error) {
    console.error("Error in getHouseholdMembers:", error);
    return [];
  }
}

export async function inviteMember(ownerId: string, data: MemberInviteFormData): Promise<HouseholdMember> {
  try {
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

    // Check if member with this email/userId already exists for this household
    if (existingUser) {
      const { data: existingMember } = await supabase
        .from("HouseholdMemberNew")
        .select("id")
        .eq("householdId", householdId)
        .eq("userId", existingUser.id)
        .maybeSingle();

      if (existingMember) {
        throw new Error("User is already a member of this household");
      }
    } else {
      // Check for pending invitation with same email
      const { data: existingPending } = await supabase
        .from("HouseholdMemberNew")
        .select("id")
        .eq("householdId", householdId)
        .eq("email", data.email.toLowerCase())
        .eq("status", "pending")
        .maybeSingle();

      if (existingPending) {
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

    // Insert into new table
    const insertData: any = {
      householdId,
      userId: existingUser?.id || null,
      email: existingUser ? null : data.email.toLowerCase(),
        name: data.name || null,
      role: data.role || "member",
      status: existingUser ? "active" : "pending",
      invitationToken: existingUser ? null : invitationToken,
        invitedAt: now,
      acceptedAt: existingUser ? now : null,
      // joinedAt is NOT NULL, so we set it to now for active users, or invitedAt for pending (will be updated when accepted)
      joinedAt: existingUser ? now : now, // For pending invitations, this will be updated when they accept
      invitedBy: currentUser.id,
      isDefault: false,
        createdAt: now,
        updatedAt: now,
    };

    const { data: member, error } = await supabase
      .from("HouseholdMemberNew")
      .insert(insertData)
      .select(`
        *,
        user:User!HouseholdMemberNew_userId_fkey(id, email, name, role)
      `)
      .single();

    if (error || !member) {
      console.error("Error inviting member:", error);
      throw new Error(`Failed to invite member: ${error?.message || JSON.stringify(error)}`);
    }

    // If user already exists, no need to send invitation email
    if (existingUser) {
      const user = member.user as any;
      return {
        id: member.id,
        ownerId,
        memberId: member.userId,
        email: user?.email || "",
        name: user?.name || member.name || null,
        role: member.role === 'owner' ? 'admin' : (member.role as "admin" | "member"),
        status: "active",
        invitationToken: "",
        invitedAt: new Date(member.invitedAt || member.createdAt),
        acceptedAt: new Date(member.acceptedAt || member.joinedAt || member.createdAt),
        createdAt: new Date(member.createdAt),
        updatedAt: new Date(member.updatedAt),
        isOwner: member.role === 'owner',
      };
    }

    // Get owner information for email
    const { data: owner, error: ownerError } = await supabase
      .from("User")
      .select("name, email")
      .eq("id", ownerId)
      .single();

    if (ownerError) {
      console.error("[MEMBERS] Error fetching owner for email:", ownerError);
      // Continue without sending email - invitation is still created
    } else if (owner) {
      // Send invitation email
      console.log("[MEMBERS] Sending invitation email to:", data.email.toLowerCase());
      let emailSent = false;
      let emailError: Error | null = null;
      
      try {
        await sendInvitationEmail({
          to: data.email.toLowerCase(),
          memberName: data.name || data.email,
          ownerName: owner.name || owner.email || "A user",
          ownerEmail: owner.email,
          invitationToken,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        emailSent = true;
        console.log("[MEMBERS] ✅ Invitation email sent successfully");
      } catch (err) {
        // Log error but don't fail the invitation
        // The invitation is still created in the database
        emailError = err instanceof Error ? err : new Error(String(err));
        console.error("[MEMBERS] ❌ Error sending invitation email:", emailError);
        console.error("[MEMBERS] Error details:", emailError.message);
        if (emailError.stack) {
          console.error("[MEMBERS] Error stack:", emailError.stack);
        }
        
        // Log the invitation link so it can be manually shared if needed
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
        const invitationLink = `${appUrl}/members/accept?token=${invitationToken}`;
        console.warn("[MEMBERS] ⚠️ Invitation created but email not sent. Manual link:", invitationLink);
      }
      
      // If email failed, log a warning but continue
      // The invitation is already created in the database
      if (!emailSent && emailError) {
        console.warn("[MEMBERS] ⚠️ Member invitation created but email delivery failed. The invitation link can be manually shared.");
      }
    } else {
      console.warn("[MEMBERS] ⚠️ Owner not found for userId:", ownerId, "- Email not sent");
      console.warn("[MEMBERS] ⚠️ Invitation created but email not sent due to missing owner data.");
    }

    // Map to old interface
    return {
      id: member.id,
      ownerId,
      memberId: member.userId || null,
      email: member.email || "",
      name: member.name || null,
      role: member.role === 'owner' ? 'admin' : (member.role as "admin" | "member"),
      status: member.status as "pending" | "active" | "declined",
      invitationToken: member.invitationToken || "",
      invitedAt: new Date(member.invitedAt || member.createdAt),
      acceptedAt: member.acceptedAt ? new Date(member.acceptedAt) : null,
      createdAt: new Date(member.createdAt),
      updatedAt: new Date(member.updatedAt),
      isOwner: member.role === 'owner',
    };
  } catch (error) {
    console.error("Error in inviteMember:", error);
    throw error;
  }
}

export async function updateMember(memberId: string, data: MemberUpdateFormData): Promise<HouseholdMember> {
  try {
    const supabase = await createServerClient();

    // Get current member data from new table
    const { data: currentMember, error: fetchError } = await supabase
      .from("HouseholdMemberNew")
      .select(`
        *,
        user:User!HouseholdMemberNew_userId_fkey(id, email, name, role)
      `)
      .eq("id", memberId)
      .single();

    if (fetchError || !currentMember) {
      throw new Error("Member not found");
    }

    const now = formatTimestamp(new Date());
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    // Update name if provided (update in HouseholdMemberNew if pending, or in User if active)
    if (data.name !== undefined) {
      if (currentMember.status === 'pending') {
      updateData.name = data.name || null;
      } else if (currentMember.userId) {
        // Update User table for active members
        const { error: userUpdateError } = await supabase
          .from("User")
          .update({ name: data.name || null, updatedAt: now })
          .eq("id", currentMember.userId);
        
        if (userUpdateError) {
          console.error("Error updating user name:", userUpdateError);
        }
      }
    }

    // Update email if provided and different
    let emailChanged = false;
    const currentEmail = (currentMember.user as any)?.email || currentMember.email || "";
    if (data.email !== undefined && data.email.toLowerCase() !== currentEmail.toLowerCase()) {
      // Check if email is already used by another member for this household
      const { data: existingUser } = await supabase
        .from("User")
        .select("id")
        .eq("email", data.email.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        const { data: existingMember } = await supabase
          .from("HouseholdMemberNew")
          .select("id")
          .eq("householdId", currentMember.householdId)
          .eq("userId", existingUser.id)
        .neq("id", memberId)
          .maybeSingle();

        if (existingMember) {
        throw new Error("Email is already used by another member");
      }
      } else {
        // Check for pending invitation with same email
        const { data: existingPending } = await supabase
          .from("HouseholdMemberNew")
          .select("id")
          .eq("householdId", currentMember.householdId)
          .eq("email", data.email.toLowerCase())
          .neq("id", memberId)
          .maybeSingle();

        if (existingPending) {
          throw new Error("Email is already used by another member");
        }
      }

      if (currentMember.status === 'pending') {
      updateData.email = data.email.toLowerCase();
      } else if (currentMember.userId) {
        // Update User table for active members
        const { error: userUpdateError } = await supabase
          .from("User")
          .update({ email: data.email.toLowerCase(), updatedAt: now })
          .eq("id", currentMember.userId);
        
        if (userUpdateError) {
          console.error("Error updating user email:", userUpdateError);
          throw new Error(`Failed to update email: ${userUpdateError.message}`);
        }
      }
      emailChanged = true;
    }

    // Update role if provided (map 'admin'/'member' to 'owner'/'admin'/'member')
    if (data.role !== undefined) {
      // Map old role system to new: 'admin' -> 'admin', 'member' -> 'member'
      // Note: 'owner' role cannot be changed via this API
      updateData.role = data.role === 'admin' ? 'admin' : 'member';
    }

    // If email changed and member is pending, generate new token and resend invitation
    if (emailChanged && currentMember.status === "pending") {
      const newToken = crypto.randomUUID();
      updateData.invitationToken = newToken;
      updateData.invitedAt = now;

      // Update member
      const { data: updatedMember, error: updateError } = await supabase
        .from("HouseholdMemberNew")
        .update(updateData)
        .eq("id", memberId)
        .select(`
          *,
          user:User!HouseholdMemberNew_userId_fkey(id, email, name, role)
        `)
        .single();

      if (updateError || !updatedMember) {
        console.error("Error updating member:", updateError);
        throw new Error(`Failed to update member: ${updateError?.message || JSON.stringify(updateError)}`);
      }

      // Get household to find owner
      const { data: household } = await supabase
        .from("Household")
        .select("createdBy")
        .eq("id", currentMember.householdId)
        .single();

      // Resend invitation email with new token
      if (household) {
      try {
        const { data: owner, error: ownerError } = await supabase
          .from("User")
          .select("name, email")
            .eq("id", household.createdBy)
          .single();

        if (ownerError) {
          console.error("[MEMBERS] Error fetching owner for email update:", ownerError);
        } else if (owner) {
          console.log("[MEMBERS] Sending invitation email after email update to:", updateData.email);
          await sendInvitationEmail({
            to: updateData.email as string,
            memberName: (updateData.name as string) || updateData.email as string,
            ownerName: owner.name || owner.email || "A user",
            ownerEmail: owner.email,
            invitationToken: newToken,
            appUrl: process.env.NEXT_PUBLIC_APP_URL,
          });
          console.log("[MEMBERS] ✅ Invitation email sent after email update");
        } else {
          console.warn("[MEMBERS] ⚠️ Owner not found for email update - Email not sent");
        }
      } catch (emailError) {
        console.error("[MEMBERS] ❌ Error sending invitation email after email update:", emailError);
        if (emailError instanceof Error) {
          console.error("[MEMBERS] Error details:", emailError.message);
        }
        // Don't fail the update if email sending fails
        }
      }

      // Map to old interface
      return {
        id: updatedMember.id,
        ownerId: household?.createdBy || "",
        memberId: updatedMember.userId || null,
        email: updatedMember.email || "",
        name: updatedMember.name || null,
        role: updatedMember.role === 'owner' ? 'admin' : (updatedMember.role as "admin" | "member"),
        status: updatedMember.status as "pending" | "active" | "declined",
        invitationToken: updatedMember.invitationToken || "",
        invitedAt: new Date(updatedMember.invitedAt || updatedMember.createdAt),
        acceptedAt: updatedMember.acceptedAt ? new Date(updatedMember.acceptedAt) : null,
        createdAt: new Date(updatedMember.createdAt),
        updatedAt: new Date(updatedMember.updatedAt),
        isOwner: updatedMember.role === 'owner',
      };
    }

    // Update member (for active members or non-email changes)
    const { data: updatedMember, error: updateError } = await supabase
      .from("HouseholdMemberNew")
      .update(updateData)
      .eq("id", memberId)
      .select(`
        *,
        user:User(id, email, name, role)
      `)
      .single();

    if (updateError || !updatedMember) {
      console.error("Error updating member:", updateError);
      throw new Error(`Failed to update member: ${updateError?.message || JSON.stringify(updateError)}`);
    }

    // Get household to find owner
    const { data: household } = await supabase
      .from("Household")
      .select("createdBy")
      .eq("id", updatedMember.householdId)
      .single();

    // Map to old interface
    const user = updatedMember.user as any;
    return {
      id: updatedMember.id,
      ownerId: household?.createdBy || "",
      memberId: updatedMember.userId || null,
      email: user?.email || updatedMember.email || "",
      name: user?.name || updatedMember.name || null,
      role: updatedMember.role === 'owner' ? 'admin' : (updatedMember.role as "admin" | "member"),
      status: updatedMember.status as "pending" | "active" | "declined",
      invitationToken: updatedMember.invitationToken || "",
      invitedAt: new Date(updatedMember.invitedAt || updatedMember.createdAt),
      acceptedAt: updatedMember.acceptedAt ? new Date(updatedMember.acceptedAt) : null,
      createdAt: new Date(updatedMember.createdAt),
      updatedAt: new Date(updatedMember.updatedAt),
      isOwner: updatedMember.role === 'owner',
    };
  } catch (error) {
    console.error("Error in updateMember:", error);
    throw error;
  }
}

export async function removeMember(memberId: string): Promise<void> {
  try {
    const supabase = await createServerClient();

    // Get member info before deleting
    const { data: member, error: fetchError } = await supabase
      .from("HouseholdMemberNew")
      .select(`
        *,
        user:User!HouseholdMemberNew_userId_fkey(id, email, name)
      `)
      .eq("id", memberId)
      .single();

    if (fetchError || !member) {
      throw new Error("Member not found");
    }

    // Only proceed if member has a userId (is an active member, not just pending)
    if (member.userId) {
      const userId = member.userId;

      // Check if user already has their own personal household
      const { data: existingPersonalHousehold } = await supabase
        .from("HouseholdMemberNew")
        .select("householdId, Household(type)")
        .eq("userId", userId)
        .eq("isDefault", true)
        .maybeSingle();

      // If user doesn't have their own personal household, create one
      if (!existingPersonalHousehold) {
        const { createHousehold } = await import("@/lib/api/households");
        try {
          const user = member.user as any;
          await createHousehold(
            userId,
            user?.name || user?.email || "Minha Conta",
            'personal'
          );
          console.log("[MEMBERS] removeMember - Created personal household for removed member:", userId);
        } catch (createError) {
          console.error("Error creating personal household for removed member:", createError);
          // Don't fail the removal if household creation fails, but log it
        }
      }
    }

    // Delete the member from the household
    const { error } = await supabase
      .from("HouseholdMemberNew")
      .delete()
      .eq("id", memberId);

    if (error) {
      console.error("Error removing member:", error);
      throw new Error(`Failed to remove member: ${error.message || JSON.stringify(error)}`);
    }
  } catch (error) {
    console.error("Error in removeMember:", error);
    throw error;
  }
}

export async function resendInvitationEmail(memberId: string): Promise<void> {
  try {
    const supabase = await createServerClient();

    // Get member data from new table
    const { data: member, error: fetchError } = await supabase
      .from("HouseholdMemberNew")
      .select(`
        *,
        Household(createdBy)
      `)
      .eq("id", memberId)
      .single();

    if (fetchError || !member) {
      throw new Error("Member not found");
    }

    // Only resend for pending invitations
    if (member.status !== "pending") {
      throw new Error("Can only resend invitation for pending members");
    }

    if (!member.invitationToken || !member.email) {
      throw new Error("Invalid invitation: missing token or email");
    }

    // Get owner information for email
    const household = member.Household as any;
    const { data: owner, error: ownerError } = await supabase
      .from("User")
      .select("name, email")
      .eq("id", household?.createdBy)
      .single();

    if (ownerError || !owner) {
      console.error("[MEMBERS] Error fetching owner for resend email:", ownerError);
      throw new Error("Owner not found");
    }

    // Send invitation email
    console.log("[MEMBERS] Resending invitation email to:", member.email);
    await sendInvitationEmail({
      to: member.email,
      memberName: member.name || member.email,
      ownerName: owner.name || owner.email || "A user",
      ownerEmail: owner.email,
      invitationToken: member.invitationToken,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
    console.log("[MEMBERS] ✅ Resend invitation email sent successfully");
  } catch (error) {
    console.error("Error resending invitation email:", error);
    throw error;
  }
}

export async function acceptInvitation(token: string, userId: string): Promise<HouseholdMember> {
  try {
    const supabase = await createServerClient();

    // Find the invitation by token in new table
    const { data: invitation, error: findError } = await supabase
      .from("HouseholdMemberNew")
      .select(`
        *,
        Household(createdBy, id)
      `)
      .eq("invitationToken", token)
      .eq("status", "pending")
      .single();

    if (findError || !invitation) {
      throw new Error("Invalid or expired invitation token");
    }

    // Get auth user info to verify email
    const { data: { user: authUserData }, error: authUserError } = await supabase.auth.getUser();
    
    if (authUserError || !authUserData) {
      throw new Error("User not authenticated");
    }

    // Verify email matches invitation
    if (invitation.email && authUserData.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("Email does not match the invitation");
    }

    // Check if User exists, if not create it
    const { data: existingUser } = await supabase
      .from("User")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle();

    const now = formatTimestamp(new Date());
    const household = invitation.Household as any;
    
    // Create User if it doesn't exist
    if (!existingUser) {
      const { error: createUserError } = await supabase
        .from("User")
        .insert({
          id: userId,
          email: authUserData.email!,
          name: invitation.name || null,
          role: invitation.role === 'owner' ? 'admin' : (invitation.role || "member"),
          createdAt: now,
          updatedAt: now,
        });

      if (createUserError) {
        console.error("Error creating user:", createUserError);
        throw new Error(`Failed to create user: ${createUserError.message || JSON.stringify(createUserError)}`);
      }
    } else {
      // Update existing user's role based on invitation role
      const { error: roleUpdateError } = await supabase
        .from("User")
        .update({
          role: invitation.role === 'owner' ? 'admin' : (invitation.role || "member"),
          updatedAt: now,
        })
        .eq("id", userId);

      if (roleUpdateError) {
        console.error("Error updating user role:", roleUpdateError);
        // Don't fail the invitation if role update fails
      }
    }

    // Update the invitation to active status and link the member
    const { data: member, error: updateError } = await supabase
      .from("HouseholdMemberNew")
      .update({
        userId: userId,
        status: "active",
        acceptedAt: now,
        joinedAt: now,
        email: null, // Clear email now that user is linked
        name: null, // Clear name now that user is linked
        invitationToken: null, // Clear token
        updatedAt: now,
      })
      .eq("id", invitation.id)
      .select(`
        *,
        user:User!HouseholdMemberNew_userId_fkey(id, email, name, role),
        Household(createdBy, id)
      `)
      .single();

    if (updateError || !member) {
      console.error("Error accepting invitation:", updateError);
      throw new Error(`Failed to accept invitation: ${updateError?.message || JSON.stringify(updateError)}`);
    }

    console.log("[MEMBERS] acceptInvitation - Member accepted invitation:", {
      memberId: member.userId,
      userId,
      householdId: member.householdId,
      status: member.status,
    });

    // Set the household as active for the new member
    // This ensures they see the shared household data and inherit the subscription
    try {
      const { error: activeError } = await supabase
        .from("UserActiveHousehold")
        .upsert({
          userId: userId,
          householdId: member.householdId,
          updatedAt: now,
        }, {
          onConflict: "userId"
        });
      
      if (activeError) {
        console.warn("[MEMBERS] Could not set active household for new member:", activeError);
      } else {
        console.log("[MEMBERS] Set active household for new member:", { userId, householdId: member.householdId });
      }
    } catch (activeError) {
      console.warn("[MEMBERS] Error setting active household:", activeError);
    }

    // Update subscription cache for the new member
    try {
      const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
      await invalidateSubscriptionCache(userId);
      console.log("[MEMBERS] Subscription cache invalidated for new member");
    } catch (cacheError) {
      console.warn("[MEMBERS] Could not invalidate subscription cache:", cacheError);
    }

    // Map to old interface
    const user = member.user as any;
    const memberHousehold = member.Household as any;
    return {
      id: member.id,
      ownerId: memberHousehold?.createdBy || "",
      memberId: member.userId,
      email: user?.email || "",
      name: user?.name || null,
      role: member.role === 'owner' ? 'admin' : (member.role as "admin" | "member"),
      status: "active",
      invitationToken: "",
      invitedAt: new Date(member.invitedAt || member.createdAt),
      acceptedAt: new Date(member.acceptedAt || member.joinedAt || member.createdAt),
      createdAt: new Date(member.createdAt),
      updatedAt: new Date(member.updatedAt),
      isOwner: member.role === 'owner',
    };
  } catch (error) {
    console.error("Error in acceptInvitation:", error);
    throw error;
  }
}

export async function acceptInvitationWithPassword(token: string, password: string): Promise<{ 
  member: HouseholdMember | null; 
  session: any; 
  requiresOtpVerification?: boolean;
  email?: string;
  invitationId?: string;
  userId?: string;
}> {
  try {
    // First, validate the token using the secure function (no service role needed)
    const supabase = await createServerClient();
    
    const { data: invitationData, error: validateError } = await supabase
      .rpc("validate_invitation_token", { p_token: token });

    if (validateError || !invitationData || invitationData.length === 0) {
      console.error("[MEMBERS] Error validating invitation token:", validateError);
      throw new Error("Invalid or expired invitation token");
    }

    const invitation = invitationData[0];
    
    // Now we need service role to create the user account and update the invitation
    // This is necessary because we're creating a new user
    const serviceRoleClient = createServiceRoleClient();
    
    // Get full invitation details using service role (needed for creating account)
    const { data: fullInvitation, error: findError } = await serviceRoleClient
      .from("HouseholdMemberNew")
      .select(`
        *,
        Household(createdBy, id)
      `)
      .eq("id", invitation.id)
      .eq("status", "pending")
      .single();

    if (findError || !fullInvitation) {
      console.error("[MEMBERS] Error finding full invitation:", findError);
      throw new Error("Invalid or expired invitation token");
    }

    if (!fullInvitation.email) {
      throw new Error("Invitation is missing email");
    }

    // Check password against HIBP before attempting signup
    const passwordValidation = await validatePasswordAgainstHIBP(password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.error || "Invalid password");
    }

    // Create user in Supabase Auth using service role client
    // Note: signUp will fail if email already exists, which is what we want
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
      console.error("Error creating auth user:", authError);
      
      // Get user-friendly error message (handles HIBP errors automatically)
      const errorMessage = getAuthErrorMessage(authError, "Failed to create account");
      throw new Error(errorMessage);
    }

    if (!authData.user) {
      throw new Error("Failed to create account. Please try again.");
    }

    const userId = authData.user.id;
    const now = formatTimestamp(new Date());

    // Send OTP email for verification
    // Don't confirm email automatically - user must verify OTP
    console.log("[MEMBERS] Sending OTP email for invitation acceptance");
    const { error: otpError } = await serviceRoleClient.auth.resend({
      type: "signup",
      email: fullInvitation.email,
    });

    if (otpError) {
      console.error("[MEMBERS] Error sending OTP:", otpError);
      // Continue anyway - OTP might have been sent automatically by Supabase
    } else {
      console.log("[MEMBERS] ✅ OTP email sent successfully");
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
      console.error("Error creating user:", createUserError);
      throw new Error(`Failed to create user: ${createUserError.message || JSON.stringify(createUserError)}`);
    }

    // Return without session - user needs to verify OTP first
    // The invitation will be completed after OTP verification
    return {
      member: null, // Will be set after OTP verification
      session: null, // No session until OTP is verified
      requiresOtpVerification: true,
      email: fullInvitation.email,
      invitationId: fullInvitation.id,
      userId: userId,
    };
  } catch (error) {
    console.error("Error in acceptInvitationWithPassword:", error);
    throw error;
  }
}

/**
 * Complete invitation acceptance after OTP verification
 * This is called after the user verifies their email with OTP
 */
export async function completeInvitationAfterOtp(userId: string, invitationId: string): Promise<{ member: HouseholdMember; session: any }> {
  try {
    const serviceRoleClient = createServiceRoleClient();
    const now = formatTimestamp(new Date());

    // Get the invitation to verify it's still pending
    const { data: invitation, error: findError } = await serviceRoleClient
      .from("HouseholdMemberNew")
      .select(`
        *,
        Household(createdBy, id)
      `)
      .eq("id", invitationId)
      .eq("status", "pending")
      .single();

    if (findError || !invitation) {
      throw new Error("Invitation not found or already accepted");
    }

    // Verify the userId matches the invitation email
    const { data: userData } = await serviceRoleClient
      .from("User")
      .select("email")
      .eq("id", userId)
      .single();

    if (!userData || (invitation.email && userData.email.toLowerCase() !== invitation.email.toLowerCase())) {
      throw new Error("User email does not match invitation");
    }

    // Update the invitation to active status and link the member
    const { data: updatedMember, error: updateError } = await serviceRoleClient
      .from("HouseholdMemberNew")
      .update({
        userId: userId,
        status: "active",
        acceptedAt: now,
        joinedAt: now,
        email: null, // Clear email now that user is linked
        name: null, // Clear name now that user is linked
        invitationToken: null, // Clear token
        updatedAt: now,
      })
      .eq("id", invitationId)
      .eq("status", "pending") // Double-check it's still pending
      .select(`
        *,
        user:User!HouseholdMemberNew_userId_fkey(id, email, name, role),
        Household(createdBy, id)
      `)
      .single();

    if (updateError || !updatedMember) {
      console.error("Error completing invitation:", updateError);
      throw new Error(`Failed to complete invitation: ${updateError?.message || JSON.stringify(updateError)}`);
    }

    const household = updatedMember.Household as any;
    console.log("[MEMBERS] completeInvitationAfterOtp - Member accepted invitation:", {
      memberId: updatedMember.userId,
      userId,
      householdId: updatedMember.householdId,
      status: updatedMember.status,
    });

    // Set the household as active for the new member
    // This ensures they see the shared household data and inherit the subscription
    try {
      const { error: activeError } = await serviceRoleClient
        .from("UserActiveHousehold")
        .upsert({
          userId: userId,
          householdId: updatedMember.householdId,
          updatedAt: now,
        }, {
          onConflict: "userId"
        });
      
      if (activeError) {
        console.warn("[MEMBERS] Could not set active household for new member:", activeError);
      } else {
        console.log("[MEMBERS] Set active household for new member:", { userId, householdId: updatedMember.householdId });
      }
    } catch (activeError) {
      console.warn("[MEMBERS] Error setting active household:", activeError);
    }

    // Update subscription cache in User table for the new member
    // This uses the PostgreSQL function to sync cache immediately
    try {
      const { error: cacheUpdateError } = await serviceRoleClient.rpc(
        "update_user_subscription_cache",
        { p_user_id: userId }
      );
      
      if (cacheUpdateError) {
        console.warn("[MEMBERS] Could not update subscription cache via RPC:", cacheUpdateError);
        // Fallback: invalidate cache and let it refresh on next query
        const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
        await invalidateSubscriptionCache(userId);
      } else {
        console.log("[MEMBERS] Subscription cache updated in User table for new member");
      }
    } catch (cacheError) {
      console.warn("[MEMBERS] Could not update subscription cache:", cacheError);
      // Fallback: invalidate cache
      try {
        const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
        await invalidateSubscriptionCache(userId);
      } catch (invalidateError) {
        console.warn("[MEMBERS] Could not invalidate subscription cache:", invalidateError);
      }
    }

    // Get session for the authenticated user
    // Use createServerClient to get the user's session (they should be authenticated after OTP)
    const supabase = await createServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn("[MEMBERS] Could not get session:", sessionError);
    }

    // Map to old interface
    const user = updatedMember.user as any;
    return {
      member: {
        id: updatedMember.id,
        ownerId: household?.createdBy || "",
        memberId: updatedMember.userId,
        email: user?.email || "",
        name: user?.name || null,
        role: updatedMember.role === 'owner' ? 'admin' : (updatedMember.role as "admin" | "member"),
        status: "active",
        invitationToken: "",
        invitedAt: new Date(updatedMember.invitedAt || updatedMember.createdAt),
        acceptedAt: new Date(updatedMember.acceptedAt || updatedMember.joinedAt || updatedMember.createdAt),
        createdAt: new Date(updatedMember.createdAt),
        updatedAt: new Date(updatedMember.updatedAt),
        isOwner: updatedMember.role === 'owner',
      },
      session: session || null,
    };
  } catch (error) {
    console.error("Error in completeInvitationAfterOtp:", error);
    throw error;
  }
}

function mapHouseholdMember(data: any): HouseholdMember {
  return {
    id: data.id,
    ownerId: data.ownerId,
    memberId: data.memberId,
    email: data.email,
    name: data.name,
    role: data.role || "member", // Default to 'member' if not set
    status: data.status,
    invitationToken: data.invitationToken,
    invitedAt: new Date(data.invitedAt),
    acceptedAt: data.acceptedAt ? new Date(data.acceptedAt) : null,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

// Check if user has admin role (either owner or admin/super_admin member)
export async function isAdmin(userId: string, ownerId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    
    // Get user's role from User table
    const { data: user } = await supabase
      .from("User")
      .select("role")
      .eq("id", userId)
      .single();

    // Owner is always admin, or check role from User table (admin or super_admin)
    return userId === ownerId || user?.role === "admin" || user?.role === "super_admin";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Get current user's role in household
export async function getUserRole(userId: string, ownerId: string): Promise<"admin" | "member" | "super_admin" | null> {
  try {
    const supabase = await createServerClient();
    
    // Get user's role from User table
    const { data: user } = await supabase
      .from("User")
      .select("role")
      .eq("id", userId)
      .single();

    // Owner is always admin, or use role from User table
    if (userId === ownerId) {
      return "admin";
    }

    return (user?.role as "admin" | "member" | "super_admin") || null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}

// Check if user is an active household member (in any household, not their own)
export async function isHouseholdMember(userId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    
    // Check if user is a member of any household (excluding their own personal household)
    const { data: member, error } = await supabase
      .from("HouseholdMemberNew")
      .select(`
        id,
        status,
        userId,
        householdId,
        Household(type, createdBy)
      `)
      .eq("userId", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("[MEMBERS] Error checking household membership:", error);
      return false;
    }

    // Ignore personal households (where user is owner)
    if (member) {
      const household = member.Household as any;
      if (household?.type === 'personal' && household?.createdBy === userId) {
        console.log("[MEMBERS] Ignoring personal household (user is owner)", { userId });
      return false;
      }
    }

    const isMember = member !== null;
    console.log("[MEMBERS] isHouseholdMember - userId:", userId, "isMember:", isMember, "member:", member);
    return isMember;
  } catch (error) {
    console.error("[MEMBERS] Error in isHouseholdMember:", error);
    return false;
  }
}

// Get ownerId (household creator) for a household member
export async function getOwnerIdForMember(userId: string): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    
    // Get the household where user is a member (excluding personal)
    const { data: member, error } = await supabase
      .from("HouseholdMemberNew")
      .select(`
        householdId,
        status,
        userId,
        Household(type, createdBy)
      `)
      .eq("userId", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("[MEMBERS] Error getting ownerId for member:", error);
      return null;
    }

    if (!member) {
      return null;
    }

    const household = member.Household as any;
    const ownerId = household?.createdBy || null;
    
    // Ignore personal households (user is their own owner)
    if (household?.type === 'personal' && ownerId === userId) {
      console.log("[MEMBERS] Ignoring personal household (user is their own owner)", { userId });
      return null;
    }
    
    console.log("[MEMBERS] getOwnerIdForMember - userId:", userId, "ownerId:", ownerId, "member:", member);
    return ownerId;
  } catch (error) {
    console.error("[MEMBERS] Error in getOwnerIdForMember:", error);
    return null;
  }
}

export interface UserHouseholdInfo {
  isOwner: boolean;
  isMember: boolean;
  ownerId?: string;
  ownerName?: string;
}

export async function getUserHouseholdInfo(userId: string): Promise<UserHouseholdInfo | null> {
  try {
    const supabase = await createServerClient();
    
    // Check if user is an owner (has created a household)
    const { data: ownedHousehold, error: ownerError } = await supabase
      .from("Household")
      .select("id, type")
      .eq("createdBy", userId)
      .limit(1)
      .maybeSingle();

    if (ownerError && ownerError.code !== "PGRST116") {
      console.error("[MEMBERS] Error checking if user is owner:", ownerError);
    }

    const isOwner = ownedHousehold !== null;

    // Check if user is a member (in a household that's not their own)
    const isMember = await isHouseholdMember(userId);
    
    if (!isOwner && !isMember) {
      // User is neither owner nor member
      return {
        isOwner: false,
        isMember: false,
      };
    }

    if (isOwner) {
      // User is an owner (has created at least one household)
      return {
        isOwner: true,
        isMember: false,
      };
    }

    // User is a member, get owner info
    const ownerId = await getOwnerIdForMember(userId);
    
    if (ownerId) {
      // Get owner's name
      const { data: owner, error: ownerDataError } = await supabase
        .from("User")
        .select("name, email")
        .eq("id", ownerId)
        .maybeSingle();

      if (ownerDataError && ownerDataError.code !== "PGRST116") {
        console.error("[MEMBERS] Error fetching owner data:", ownerDataError);
      }

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
    console.error("[MEMBERS] Error in getUserHouseholdInfo:", error);
    return {
      isOwner: false,
      isMember: false,
    };
  }
}



