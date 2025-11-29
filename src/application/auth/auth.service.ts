/**
 * Auth Service
 * Business logic for authentication
 */

import { AuthRepository } from "../../infrastructure/database/repositories/auth.repository";
import { AuthMapper } from "./auth.mapper";
import { SignUpFormData, SignInFormData, ForgotPasswordFormData, ResetPasswordFormData, ChangePasswordFormData } from "../../domain/auth/auth.validations";
import { BaseUser, AuthResult } from "../../domain/auth/auth.types";
import { createServerClient } from "../../infrastructure/database/supabase-server";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { logger } from "@/src/infrastructure/utils/logger";

export class AuthService {
  constructor(private repository: AuthRepository) {}

  /**
   * Sign up a new user
   */
  async signUp(data: SignUpFormData): Promise<AuthResult> {
    try {
      // Check password against HIBP
      const passwordValidation = await validatePasswordAgainstHIBP(data.password);
      if (!passwordValidation.isValid) {
        return { user: null, error: passwordValidation.error || "Invalid password" };
      }

      const supabase = await createServerClient();

      // Check for pending invitation
      const pendingInvitation = await this.repository.findPendingInvitation(data.email);
      if (pendingInvitation) {
        return {
          user: null,
          error: "This email has a pending household invitation. Please accept the invitation from your email or use the invitation link to create your account."
        };
      }

      // Sign up with Supabase Auth
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
        const errorMessage = getAuthErrorMessage(authError, "Failed to sign up");
        return { user: null, error: errorMessage };
      }

      // Create user profile
      let userData: any;
      try {
        userData = await this.repository.createUser({
          id: authData.user.id,
          email: authData.user.email!,
          name: data.name || null,
          role: "admin", // Owners who sign up directly are admins
        });
      } catch (error) {
        logger.error("Error creating user profile:", error);
        // User is created in auth but not in User table - this is OK, will be created on first login
      }

      // Create personal household if user was created
      if (userData) {
        await this.createPersonalHousehold(userData.id, data.name || userData.email);
      }

      return { user: userData ? AuthMapper.toDomain(userData) : null, error: null };
    } catch (error) {
      logger.error("Error in signUp:", error);
      return { user: null, error: error instanceof Error ? error.message : "Failed to sign up" };
    }
  }

  /**
   * Sign in user
   */
  async signIn(data: SignInFormData): Promise<AuthResult> {
    try {
      const supabase = await createServerClient();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError || !authData.user) {
        const errorMessage = getAuthErrorMessage(authError, "Failed to sign in");
        return { user: null, error: errorMessage };
      }

      // Get or create user profile
      let userData = await this.repository.findById(authData.user.id);

      if (!userData) {
        // Create user profile if it doesn't exist
        try {
          userData = await this.repository.createUser({
            id: authData.user.id,
            email: authData.user.email!,
            name: authData.user.user_metadata?.name || null,
            role: "admin",
          });

          // Create personal household
          await this.createPersonalHousehold(userData.id, userData.name || userData.email);
        } catch (error) {
          logger.error("Error creating user profile:", error);
          return { user: null, error: "Failed to create user profile" };
        }
      }

      return { user: AuthMapper.toDomain(userData), error: null };
    } catch (error) {
      logger.error("Error in signIn:", error);
      return { user: null, error: error instanceof Error ? error.message : "Failed to sign in" };
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<{ error: string | null }> {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.auth.signOut();
      return { error: error ? error.message : null };
    } catch (error) {
      logger.error("Error in signOut:", error);
      return { error: error instanceof Error ? error.message : "Failed to sign out" };
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<BaseUser | null> {
    try {
      const supabase = await createServerClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return null;
      }

      const userData = await this.repository.findById(user.id);
      if (!userData) {
        return null;
      }

      return AuthMapper.toDomain(userData);
    } catch (error) {
      logger.error("Error in getCurrentUser:", error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: { name?: string; avatarUrl?: string; phoneNumber?: string }): Promise<AuthResult> {
    try {
      const supabase = await createServerClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return { user: null, error: "Unauthorized" };
      }

      const updatedUser = await this.repository.updateUser(user.id, {
        name: data.name,
        avatarUrl: data.avatarUrl,
        phoneNumber: data.phoneNumber,
      });

      return { user: AuthMapper.toDomain(updatedUser), error: null };
    } catch (error) {
      logger.error("Error in updateProfile:", error);
      return { user: null, error: error instanceof Error ? error.message : "Failed to update profile" };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: ForgotPasswordFormData): Promise<{ error: string | null }> {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
      });

      return { error: error ? getAuthErrorMessage(error, "Failed to send password reset email") : null };
    } catch (error) {
      logger.error("Error in requestPasswordReset:", error);
      return { error: error instanceof Error ? error.message : "Failed to request password reset" };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(data: ResetPasswordFormData): Promise<{ error: string | null }> {
    try {
      // Check password against HIBP
      const passwordValidation = await validatePasswordAgainstHIBP(data.password);
      if (!passwordValidation.isValid) {
        return { error: passwordValidation.error || "Invalid password" };
      }

      const supabase = await createServerClient();
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      return { error: error ? getAuthErrorMessage(error, "Failed to reset password") : null };
    } catch (error) {
      logger.error("Error in resetPassword:", error);
      return { error: error instanceof Error ? error.message : "Failed to reset password" };
    }
  }

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordFormData): Promise<{ error: string | null }> {
    try {
      // Check new password against HIBP
      const passwordValidation = await validatePasswordAgainstHIBP(data.newPassword);
      if (!passwordValidation.isValid) {
        return { error: passwordValidation.error || "Invalid password" };
      }

      const supabase = await createServerClient();

      // Verify current password by attempting to sign in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        return { error: "User not authenticated" };
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: data.currentPassword,
      });

      if (verifyError) {
        return { error: "Current password is incorrect" };
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      return { error: error ? getAuthErrorMessage(error, "Failed to change password") : null };
    } catch (error) {
      logger.error("Error in changePassword:", error);
      return { error: error instanceof Error ? error.message : "Failed to change password" };
    }
  }

  /**
   * Helper: Create personal household for new user
   */
  private async createPersonalHousehold(userId: string, name: string): Promise<void> {
    const supabase = await createServerClient();
    const now = formatTimestamp(new Date());

    // Check if personal household already exists
    const { data: existingHousehold } = await supabase
      .from("Household")
      .select("id")
      .eq("createdBy", userId)
      .eq("type", "personal")
      .maybeSingle();

    if (existingHousehold) {
      return;
    }

    // Create personal household
    const { data: household, error: householdError } = await supabase
      .from("Household")
      .insert({
        name: name || "Minha Conta",
        type: "personal",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        settings: {},
      })
      .select()
      .single();

    if (householdError || !household) {
      logger.error("Error creating personal household:", householdError);
      return;
    }

    // Create HouseholdMemberNew (owner role, active, default)
    const { error: memberError } = await supabase
      .from("HouseholdMemberNew")
      .insert({
        householdId: household.id,
        userId: userId,
        role: "owner",
        status: "active",
        isDefault: true,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      });

    if (memberError) {
      logger.error("Error creating household member:", memberError);
      return;
    }

    // Set as active household
    const { error: activeError } = await supabase
      .from("UserActiveHousehold")
      .insert({
        userId: userId,
        householdId: household.id,
        updatedAt: now,
      });

    if (activeError) {
      logger.error("Error setting active household:", activeError);
    }

    // Create emergency fund goal for new user
    try {
      const { ensureEmergencyFundGoal } = await import("@/lib/api/goals");
      await ensureEmergencyFundGoal(userId, household.id);
    } catch (goalError) {
      logger.error("Error creating emergency fund goal:", goalError);
      // Don't fail if goal creation fails
    }
  }
}

