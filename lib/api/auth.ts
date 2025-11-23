"use server";

import { createServerClient } from "@/lib/supabase-server";
import { SignUpFormData, SignInFormData, ForgotPasswordFormData, ResetPasswordFormData, ChangePasswordFormData } from "@/lib/validations/auth";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { formatTimestamp } from "@/lib/utils/timestamp";
import { cookies } from "next/headers";

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  role?: "admin" | "member" | "super_admin";
  createdAt: Date;
  updatedAt: Date;
}

export async function signUp(data: SignUpFormData): Promise<{ user: User | null; error: string | null }> {
  try {
    // Check password against HIBP before attempting signup
    const passwordValidation = await validatePasswordAgainstHIBP(data.password);
    if (!passwordValidation.isValid) {
      return { user: null, error: passwordValidation.error || "Invalid password" };
    }
    
    const supabase = await createServerClient();

    // Check if email has a pending invitation
    const { data: pendingInvitation } = await supabase
      .from("HouseholdMemberNew")
      .select("id, householdId, email, Household(createdBy)")
      .eq("email", data.email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (pendingInvitation) {
      return { 
        user: null, 
        error: "This email has a pending household invitation. Please accept the invitation from your email or use the invitation link to create your account." 
      };
    }
    
    // Sign up user with Supabase Auth
    // Use both 'name' and 'full_name' for compatibility with Supabase Auth Display name
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name || "",
          full_name: data.name || "",
        },
      },
    });

    if (authError || !authData.user) {
      // Get user-friendly error message (handles HIBP errors automatically)
      const errorMessage = getAuthErrorMessage(authError, "Failed to sign up");
      return { user: null, error: errorMessage };
    }

    // Create user profile in User table (owners sign up directly, so they are admin)
    const { data: userData, error: userError } = await supabase
      .from("User")
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        name: data.name || null,
        role: "admin", // Owners who sign up directly are admins
      })
      .select()
      .single();

    if (userError) {
      console.error("Error creating user profile:", userError);
      // User is created in auth but not in User table - this is OK, will be created on first login
    }

    // Create personal group for the new user
    if (userData) {
      const now = formatTimestamp(new Date());
      
      // Check if personal household already exists
      const { data: existingHousehold } = await supabase
        .from("Household")
        .select("id")
        .eq("createdBy", userData.id)
        .eq("type", "personal")
        .maybeSingle();

      if (!existingHousehold) {
        // Create personal household
        const { data: household, error: householdError } = await supabase
          .from("Household")
          .insert({
            name: data.name || userData.email || "Minha Conta",
            type: "personal",
            createdBy: userData.id,
            createdAt: now,
            updatedAt: now,
            settings: {},
          })
          .select()
          .single();

        if (householdError || !household) {
          console.error("Error creating personal household:", householdError);
          // Don't fail signup if household creation fails, but log it
        } else {
          // Create HouseholdMemberNew (owner role, active, default)
          const { error: memberError } = await supabase
            .from("HouseholdMemberNew")
            .insert({
              householdId: household.id,
              userId: userData.id,
              role: "owner",
              status: "active",
              isDefault: true,
              joinedAt: now,
              createdAt: now,
              updatedAt: now,
            });

          if (memberError) {
            console.error("Error creating household member:", memberError);
          } else {
            // Set as active household
            const { error: activeError } = await supabase
              .from("UserActiveHousehold")
              .insert({
                userId: userData.id,
                householdId: household.id,
            updatedAt: now,
          });

            if (activeError) {
              console.error("Error setting active household:", activeError);
            } else {
              // Create emergency fund goal for new user
              try {
                const { ensureEmergencyFundGoal } = await import("./goals");
                await ensureEmergencyFundGoal(userData.id, household.id);
              } catch (goalError) {
                console.error("Error creating emergency fund goal:", goalError);
                // Don't fail signup if goal creation fails
              }
            }
          }
        }
      }
    }

    // Note: Subscription is NOT created automatically during signup
    // User must select a plan on /select-plan page
    // This allows users to choose their plan before being redirected to dashboard

    // Send welcome email to new user
    if (userData && authData.user?.email) {
      try {
        const { sendWelcomeEmail } = await import("@/lib/utils/email");
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
        
        await sendWelcomeEmail({
          to: authData.user.email,
          userName: "", // Not used anymore, but keeping for interface compatibility
          founderName: "Naor Tartarotti",
          appUrl: appUrl,
        });
        
        console.log("[SIGNUP] ✅ Welcome email sent successfully to:", authData.user.email);
      } catch (welcomeEmailError) {
        console.error("[SIGNUP] ❌ Error sending welcome email:", welcomeEmailError);
        // Don't fail signup if welcome email fails
      }
    }

    return { user: userData ? mapUser(userData) : null, error: null };
  } catch (error) {
    console.error("Error in signUp:", error);
    return { user: null, error: error instanceof Error ? error.message : "Failed to sign up" };
  }
}

export async function signIn(data: SignInFormData): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = await createServerClient();
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError || !authData.user) {
      // Get user-friendly error message (handles HIBP and other auth errors automatically)
      const errorMessage = getAuthErrorMessage(authError, "Failed to sign in");
      return { user: null, error: errorMessage };
    }

    // Get or create user profile
    let { data: userData } = await supabase
      .from("User")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    // Note: If account was deleted, it should already be removed from auth.users
    // This check is just a safety measure in case deletion didn't complete
    // In normal operation, deleted accounts won't exist in User table due to CASCADE

    if (!userData) {
      // Create user profile if it doesn't exist (owners who sign in directly are admins)
      const { data: newUser, error: userError } = await supabase
        .from("User")
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata?.name || null,
          role: "admin", // Owners who sign in directly are admins
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error("Error creating user profile:", userError);
        return { user: null, error: "Failed to create user profile" };
      }

      userData = newUser;

      // Create personal household for the new user
      const now = formatTimestamp(new Date());
      
      // Check if personal household already exists
      const { data: existingHousehold } = await supabase
        .from("Household")
        .select("id")
        .eq("createdBy", userData.id)
        .eq("type", "personal")
        .maybeSingle();

      if (!existingHousehold) {
        // Create personal household
        const { data: household, error: householdError } = await supabase
          .from("Household")
          .insert({
            name: userData.name || userData.email || "Minha Conta",
            type: "personal",
            createdBy: userData.id,
            createdAt: now,
            updatedAt: now,
            settings: {},
          })
          .select()
          .single();

        if (householdError || !household) {
          console.error("Error creating personal household:", householdError);
          // Don't fail signin if household creation fails, but log it
        } else {
          // Create HouseholdMemberNew (owner role, active, default)
          const { error: memberError } = await supabase
            .from("HouseholdMemberNew")
            .insert({
              householdId: household.id,
              userId: userData.id,
              role: "owner",
              status: "active",
              isDefault: true,
              joinedAt: now,
              createdAt: now,
              updatedAt: now,
            });

          if (memberError) {
            console.error("Error creating household member:", memberError);
          } else {
            // Set as active household
            const { error: activeError } = await supabase
              .from("UserActiveHousehold")
              .insert({
                userId: userData.id,
                householdId: household.id,
            updatedAt: now,
          });

            if (activeError) {
              console.error("Error setting active household:", activeError);
            } else {
              // Create emergency fund goal for new user
              try {
                const { ensureEmergencyFundGoal } = await import("./goals");
                await ensureEmergencyFundGoal(userData.id, household.id);
              } catch (goalError) {
                console.error("Error creating emergency fund goal:", goalError);
                // Don't fail signin if goal creation fails
              }
            }
          }
        }
      }

      // Note: Subscription is NOT created automatically during signin
      // User must select a plan on /select-plan page if they don't have one
    }

    return { user: mapUser(userData), error: null };
  } catch (error) {
    console.error("Error in signIn:", error);
    return { user: null, error: error instanceof Error ? error.message : "Failed to sign in" };
  }
}

export async function signOut(): Promise<{ error: string | null }> {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.signOut();
    return { error: error?.message || null };
  } catch (error) {
    console.error("Error in signOut:", error);
    return { error: error instanceof Error ? error.message : "Failed to sign out" };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    // Silently handle expected auth errors (invalid refresh tokens, etc.)
    // These are normal when user is not authenticated
    if (authError) {
      const isExpectedError = authError.message?.includes("refresh_token_not_found") ||
        authError.message?.includes("Invalid refresh token") ||
        authError.message?.includes("JWT expired") ||
        authError.message?.includes("Auth session missing");
      
      // Don't log expected errors - they're normal for unauthenticated users
      if (!isExpectedError) {
        console.warn("[getCurrentUser] Unexpected auth error:", authError.message);
      }
      return null;
    }

    if (!authUser) {
      return null;
    }

    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("*")
      .eq("id", authUser.id)
      .single();

    // If user doesn't exist in User table, logout and return null
    if (userError || !userData) {
      console.warn(`[getCurrentUser] User ${authUser.id} authenticated but not found in User table. Logging out.`);
      
      // Logout to clear session
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error("[getCurrentUser] Error signing out:", signOutError);
      }
      
      return null;
    }

    return mapUser(userData);
  } catch (error: any) {
    // Silently handle expected auth errors
    const isExpectedError = error?.message?.includes("refresh_token_not_found") ||
      error?.message?.includes("Invalid refresh token") ||
      error?.message?.includes("JWT expired") ||
      error?.message?.includes("Auth session missing");
    
    // Only log unexpected errors
    if (!isExpectedError) {
      console.error("Error in getCurrentUser:", error);
    }
    return null;
  }
}

export async function updateProfile(data: { name?: string; avatarUrl?: string; phoneNumber?: string }): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return { user: null, error: "Not authenticated" };
    }

    const updateData: { name?: string; avatarUrl?: string | null; phoneNumber?: string | null } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl || null;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber || null;

    const { data: userData, error: userError } = await supabase
      .from("User")
      .update(updateData)
      .eq("id", authUser.id)
      .select()
      .single();

    if (userError || !userData) {
      return { user: null, error: userError?.message || "Failed to update profile" };
    }

    return { user: mapUser(userData), error: null };
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return { user: null, error: error instanceof Error ? error.message : "Failed to update profile" };
  }
}

export async function requestPasswordReset(data: ForgotPasswordFormData): Promise<{ error: string | null }> {
  try {
    const supabase = await createServerClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com";
    const redirectTo = `${appUrl}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo,
    });

    if (error) {
      // Don't reveal if email exists or not for security
      // Always return success message to prevent email enumeration
      console.error("Error requesting password reset:", error);
      return { error: null }; // Return success even on error to prevent enumeration
    }

    return { error: null };
  } catch (error) {
    console.error("Error in requestPasswordReset:", error);
    // Return success to prevent email enumeration
    return { error: null };
  }
}

export async function resetPassword(data: ResetPasswordFormData): Promise<{ error: string | null }> {
  try {
    // Validate password against HIBP before attempting reset
    const passwordValidation = await validatePasswordAgainstHIBP(data.password);
    if (!passwordValidation.isValid) {
      return { error: passwordValidation.error || "Invalid password" };
    }

    const supabase = await createServerClient();
    
    // Update user password
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      const errorMessage = getAuthErrorMessage(error, "Failed to reset password");
      return { error: errorMessage };
    }

    return { error: null };
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return { error: error instanceof Error ? error.message : "Failed to reset password" };
  }
}

export async function changePassword(data: ChangePasswordFormData): Promise<{ error: string | null }> {
  try {
    const supabase = await createServerClient();
    
    // Get current user to verify they're authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: "Not authenticated" };
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: data.currentPassword,
    });

    if (signInError) {
      return { error: "Current password is incorrect" };
    }

    // Validate new password against HIBP
    const passwordValidation = await validatePasswordAgainstHIBP(data.newPassword);
    if (!passwordValidation.isValid) {
      return { error: passwordValidation.error || "Invalid password" };
    }

    // Update user password
    const { error: updateError } = await supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (updateError) {
      const errorMessage = getAuthErrorMessage(updateError, "Failed to change password");
      return { error: errorMessage };
    }

    return { error: null };
  } catch (error) {
    console.error("Error in changePassword:", error);
    return { error: error instanceof Error ? error.message : "Failed to change password" };
  }
}

function mapUser(data: any): User {
  return {
    id: data.id,
    email: data.email,
    name: data.name || undefined,
    avatarUrl: data.avatarUrl || undefined,
    phoneNumber: data.phoneNumber || undefined,
    role: data.role || "admin", // Default to admin if not set
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

