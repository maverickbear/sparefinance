"use server";

import { createServerClient } from "@/lib/supabase-server";
import { MemberInviteFormData, MemberUpdateFormData } from "@/lib/validations/member";
import { formatTimestamp } from "@/lib/utils/timestamp";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { checkPlanLimits } from "./plans";
import { sendInvitationEmail } from "@/lib/utils/email";
import { guardHouseholdMembers, throwIfNotAllowed } from "@/lib/api/feature-guard";

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

    const householdMembers: HouseholdMember[] = members.map(member => {
      const mappedMember = mapHouseholdMember(member);
      // Mark owner (where ownerId = memberId) with isOwner flag
      if (member.ownerId === member.memberId) {
        mappedMember.isOwner = true;
      }
      return mappedMember;
    });

    // Sort to ensure owner (isOwner = true) appears first
    householdMembers.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      return 0;
    });

    // If owner is not in the list (shouldn't happen with new system, but handle legacy cases)
    const hasOwner = householdMembers.some(m => m.isOwner);
    if (!hasOwner && ownerData && !ownerError) {
      const ownerMember: HouseholdMember = {
        id: ownerData.id,
        ownerId: ownerData.id,
        memberId: ownerData.id,
        email: ownerData.email,
        name: ownerData.name || null,
        role: ownerData.role || "admin", // Use role from User table
        status: "active",
        invitationToken: "", // Not needed for owner
        invitedAt: new Date(ownerData.createdAt),
        acceptedAt: new Date(ownerData.createdAt),
        createdAt: new Date(ownerData.createdAt),
        updatedAt: new Date(ownerData.updatedAt),
        isOwner: true,
      };
      
      return [ownerMember, ...householdMembers];
    }

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

    // Check if member with this email already exists for this owner
    const { data: existing } = await supabase
      .from("HouseholdMember")
      .select("id")
      .eq("ownerId", ownerId)
      .eq("email", data.email.toLowerCase())
      .single();

    if (existing) {
      throw new Error("Member with this email has already been invited");
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID();

    const now = formatTimestamp(new Date());

    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .insert({
        ownerId,
        email: data.email.toLowerCase(),
        name: data.name || null,
        role: data.role || "member", // Use provided role or default to 'member'
        status: "pending",
        invitationToken,
        invitedAt: now,
        acceptedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inviting member:", error);
      throw new Error(`Failed to invite member: ${error.message || JSON.stringify(error)}`);
    }

    // Get owner information for email
    const { data: owner } = await supabase
      .from("User")
      .select("name, email")
      .eq("id", ownerId)
      .single();

    if (owner) {
      // Send invitation email
      try {
        await sendInvitationEmail({
          to: data.email.toLowerCase(),
          memberName: data.name || data.email,
          ownerName: owner.name || owner.email || "Um usuário",
          ownerEmail: owner.email,
          invitationToken,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
      } catch (emailError) {
        // Log error but don't fail the invitation
        // The invitation is still created in the database
        console.error("Error sending invitation email:", emailError);
      }
    }

    return mapHouseholdMember(member);
  } catch (error) {
    console.error("Error in inviteMember:", error);
    throw error;
  }
}

export async function updateMember(memberId: string, data: MemberUpdateFormData): Promise<HouseholdMember> {
  try {
    const supabase = await createServerClient();

    // Get current member data
    const { data: currentMember, error: fetchError } = await supabase
      .from("HouseholdMember")
      .select("*")
      .eq("id", memberId)
      .single();

    if (fetchError || !currentMember) {
      throw new Error("Member not found");
    }

    const now = formatTimestamp(new Date());
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    // Update name if provided
    if (data.name !== undefined) {
      updateData.name = data.name || null;
    }

    // Update email if provided and different
    let emailChanged = false;
    if (data.email !== undefined && data.email.toLowerCase() !== currentMember.email.toLowerCase()) {
      // Check if email is already used by another member for this owner
      const { data: existing } = await supabase
        .from("HouseholdMember")
        .select("id")
        .eq("ownerId", currentMember.ownerId)
        .eq("email", data.email.toLowerCase())
        .neq("id", memberId)
        .single();

      if (existing) {
        throw new Error("Email is already used by another member");
      }

      updateData.email = data.email.toLowerCase();
      emailChanged = true;
    }

    // Update role if provided
    if (data.role !== undefined) {
      updateData.role = data.role;
    }

    // If email changed and member is pending, generate new token and resend invitation
    if (emailChanged && currentMember.status === "pending") {
      const newToken = crypto.randomUUID();
      updateData.invitationToken = newToken;
      updateData.invitedAt = now;

      // Update member
      // First, perform the update and check if any rows were affected
      const { data: updatedMembers, error: updateError } = await supabase
        .from("HouseholdMember")
        .update(updateData)
        .eq("id", memberId)
        .select();

      if (updateError) {
        console.error("Error updating member:", updateError);
        throw new Error(`Failed to update member: ${updateError.message || JSON.stringify(updateError)}`);
      }

      // Check if the update affected any rows
      if (!updatedMembers || updatedMembers.length === 0) {
        // This can happen if RLS policies prevent the update
        throw new Error("Member not found or you don't have permission to update this member");
      }

      // Get the updated member (should be exactly one)
      const member = updatedMembers[0];

      // Resend invitation email with new token
      try {
        const { data: owner } = await supabase
          .from("User")
          .select("name, email")
          .eq("id", currentMember.ownerId)
          .single();

        if (owner) {
          await sendInvitationEmail({
            to: updateData.email as string,
            memberName: (updateData.name as string) || updateData.email as string,
            ownerName: owner.name || owner.email || "A user",
            ownerEmail: owner.email,
            invitationToken: newToken,
            appUrl: process.env.NEXT_PUBLIC_APP_URL,
          });
        }
      } catch (emailError) {
        console.error("Error sending invitation email after email update:", emailError);
        // Don't fail the update if email sending fails
      }

      return mapHouseholdMember(member);
    }

    // If email or role changed and member is active, update User table
    if ((emailChanged || data.role !== undefined) && currentMember.status === "active" && currentMember.memberId) {
      const userUpdateData: Record<string, unknown> = {};
      
      if (emailChanged) {
        userUpdateData.email = updateData.email;
      }
      
      if (data.role !== undefined) {
        userUpdateData.role = data.role;
      }

      if (Object.keys(userUpdateData).length > 0) {
        userUpdateData.updatedAt = now;
        
        const { error: userUpdateError } = await supabase
          .from("User")
          .update(userUpdateData)
          .eq("id", currentMember.memberId);

        if (userUpdateError) {
          console.error("Error updating user:", userUpdateError);
          // Don't fail the member update if user update fails
        }
      }
    }

    // Update member
    // First, perform the update and check if any rows were affected
    const { data: updatedMembers, error: updateError } = await supabase
      .from("HouseholdMember")
      .update(updateData)
      .eq("id", memberId)
      .select();

    if (updateError) {
      console.error("Error updating member:", updateError);
      throw new Error(`Failed to update member: ${updateError.message || JSON.stringify(updateError)}`);
    }

    // Check if the update affected any rows
    if (!updatedMembers || updatedMembers.length === 0) {
      // This can happen if RLS policies prevent the update
      throw new Error("Member not found or you don't have permission to update this member");
    }

    // Get the updated member (should be exactly one)
    const member = updatedMembers[0];
    return mapHouseholdMember(member);
  } catch (error) {
    console.error("Error in updateMember:", error);
    throw error;
  }
}

export async function removeMember(memberId: string): Promise<void> {
  try {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("HouseholdMember")
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

    // Get member data
    const { data: member, error: fetchError } = await supabase
      .from("HouseholdMember")
      .select("*")
      .eq("id", memberId)
      .single();

    if (fetchError || !member) {
      throw new Error("Member not found");
    }

    // Only resend for pending invitations
    if (member.status !== "pending") {
      throw new Error("Can only resend invitation for pending members");
    }

    // Get owner information for email
    const { data: owner } = await supabase
      .from("User")
      .select("name, email")
      .eq("id", member.ownerId)
      .single();

    if (!owner) {
      throw new Error("Owner not found");
    }

    // Send invitation email
    await sendInvitationEmail({
      to: member.email,
      memberName: member.name || member.email,
      ownerName: owner.name || owner.email || "Um usuário",
      ownerEmail: owner.email,
      invitationToken: member.invitationToken,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
  } catch (error) {
    console.error("Error resending invitation email:", error);
    throw error;
  }
}

export async function acceptInvitation(token: string, userId: string): Promise<HouseholdMember> {
  try {
    const supabase = await createServerClient();

    // Find the invitation by token
    const { data: invitation, error: findError } = await supabase
      .from("HouseholdMember")
      .select("*")
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
    if (authUserData.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("Email does not match the invitation");
    }

    // Check if User exists, if not create it
    const { data: existingUser } = await supabase
      .from("User")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle();

    const now = formatTimestamp(new Date());
    
    // Create User if it doesn't exist (becomes a user of the app when accepting invite)
    if (!existingUser) {
      const { error: createUserError } = await supabase
        .from("User")
        .insert({
          id: userId,
          email: authUserData.email!,
          name: invitation.name || null,
          role: invitation.role || "member",
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
          role: invitation.role || "member",
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
      .from("HouseholdMember")
      .update({
        memberId: userId,
        status: "active",
        acceptedAt: now,
        updatedAt: now,
      })
      .eq("id", invitation.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error accepting invitation:", updateError);
      throw new Error(`Failed to accept invitation: ${updateError.message || JSON.stringify(updateError)}`);
    }

    console.log("[MEMBERS] acceptInvitation - Member accepted invitation:", {
      memberId: member.memberId,
      userId,
      ownerId: member.ownerId,
      status: member.status,
    });

    // Note: We don't create a Free subscription for members
    // Members inherit the plan from the owner (shadow subscription)
    // This is handled dynamically in getUserSubscription()

    return mapHouseholdMember(member);
  } catch (error) {
    console.error("Error in acceptInvitation:", error);
    throw error;
  }
}

export async function acceptInvitationWithPassword(token: string, password: string): Promise<{ member: HouseholdMember; session: any }> {
  try {
    const supabase = await createServerClient();

    // Find the invitation by token
    const { data: invitation, error: findError } = await supabase
      .from("HouseholdMember")
      .select("*")
      .eq("invitationToken", token)
      .eq("status", "pending")
      .single();

    if (findError || !invitation) {
      throw new Error("Invalid or expired invitation token");
    }

    // Check password against HIBP before attempting signup
    const passwordValidation = await validatePasswordAgainstHIBP(password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.error || "Invalid password");
    }

    // Create user in Supabase Auth
    // Note: signUp will fail if email already exists, which is what we want
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invitation.email,
      password: password,
      options: {
        emailRedirectTo: undefined, // Don't require email confirmation
        data: {
          name: invitation.name || "",
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

    // Sign in to get session before updating HouseholdMember (needed for RLS)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: invitation.email,
      password: password,
    });

    if (signInError || !signInData.session) {
      console.error("Error signing in after account creation:", signInError);
      throw new Error(`Failed to sign in after account creation: ${signInError?.message || "Unknown error"}`);
    }

    // Create a new client with the session to ensure RLS policies work
    const supabaseWithSession = await createServerClient(
      signInData.session.access_token,
      signInData.session.refresh_token
    );

    // Create User in User table using the authenticated client
    const { error: createUserError } = await supabaseWithSession
      .from("User")
      .insert({
        id: userId,
        email: invitation.email,
        name: invitation.name || null,
        role: invitation.role || "member",
        createdAt: now,
        updatedAt: now,
      });

    if (createUserError) {
      console.error("Error creating user:", createUserError);
      throw new Error(`Failed to create user: ${createUserError.message || JSON.stringify(createUserError)}`);
    }

    // Note: We don't create a Free subscription for members
    // Members inherit the plan from the owner (shadow subscription)
    // This is handled dynamically in getUserSubscription()

    // Update the invitation to active status and link the member
    // Now using the authenticated client so RLS policies allow the update
    const { data: updatedMembers, error: updateError } = await supabaseWithSession
      .from("HouseholdMember")
      .update({
        memberId: userId,
        status: "active",
        acceptedAt: now,
        updatedAt: now,
      })
      .eq("id", invitation.id)
      .eq("email", invitation.email) // Ensure email matches for security
      .select();

    if (updateError) {
      console.error("Error accepting invitation:", updateError);
      throw new Error(`Failed to accept invitation: ${updateError.message || JSON.stringify(updateError)}`);
    }

    // Check if the update affected any rows
    if (!updatedMembers || updatedMembers.length === 0) {
      // This can happen if RLS policies prevent the update
      throw new Error("Failed to accept invitation: Unable to update invitation. This may be due to permissions or the invitation may have already been accepted.");
    }

    // Get the updated member (should be exactly one)
    const member = updatedMembers[0];

    console.log("[MEMBERS] acceptInvitationWithPassword - Member accepted invitation:", {
      memberId: member.memberId,
      userId,
      ownerId: member.ownerId,
      status: member.status,
    });

    return {
      member: mapHouseholdMember(member),
      session: signInData?.session || null,
    };
  } catch (error) {
    console.error("Error in acceptInvitationWithPassword:", error);
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

// Check if user has admin role (either owner or admin member)
export async function isAdmin(userId: string, ownerId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    
    // Get user's role from User table
    const { data: user } = await supabase
      .from("User")
      .select("role")
      .eq("id", userId)
      .single();

    // Owner is always admin, or check role from User table
    return userId === ownerId || user?.role === "admin";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Get current user's role in household
export async function getUserRole(userId: string, ownerId: string): Promise<"admin" | "member" | null> {
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

    return (user?.role as "admin" | "member") || null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}

// Check if user is an active household member
export async function isHouseholdMember(userId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    
    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .select("id, status, memberId")
      .eq("memberId", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("[MEMBERS] Error checking household membership:", error);
      return false;
    }

    const isMember = member !== null;
    console.log("[MEMBERS] isHouseholdMember - userId:", userId, "isMember:", isMember, "member:", member);
    return isMember;
  } catch (error) {
    console.error("[MEMBERS] Error in isHouseholdMember:", error);
    return false;
  }
}

// Get ownerId for a household member
export async function getOwnerIdForMember(userId: string): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    
    const { data: member, error } = await supabase
      .from("HouseholdMember")
      .select("ownerId, status, memberId")
      .eq("memberId", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("[MEMBERS] Error getting ownerId for member:", error);
      return null;
    }

    const ownerId = member?.ownerId || null;
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
    
    // Check if user is an owner (has household members)
    const { data: ownedHousehold, error: ownerError } = await supabase
      .from("HouseholdMember")
      .select("ownerId")
      .eq("ownerId", userId)
      .limit(1)
      .maybeSingle();

    if (ownerError && ownerError.code !== "PGRST116") {
      console.error("[MEMBERS] Error checking if user is owner:", ownerError);
    }

    const isOwner = ownedHousehold !== null;

    // Check if user is a member
    const isMember = await isHouseholdMember(userId);
    
    if (!isOwner && !isMember) {
      // User is neither owner nor member
      return {
        isOwner: false,
        isMember: false,
      };
    }

    if (isOwner) {
      // User is an owner
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



