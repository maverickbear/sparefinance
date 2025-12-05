/**
 * Auth Service
 * Business logic for authentication
 */

import { AuthRepository } from "@/src/infrastructure/database/repositories/auth.repository";
import { AuthMapper } from "./auth.mapper";
import { SignUpFormData, SignInFormData, ForgotPasswordFormData, ResetPasswordFormData, ChangePasswordFormData } from "../../domain/auth/auth.validations";
import { BaseUser, AuthResult } from "../../domain/auth/auth.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { logger } from "@/src/infrastructure/utils/logger";

export class AuthService {
  constructor(private repository: AuthRepository) {}

  /**
   * Sign up a new user
   */
  async signUp(data: SignUpFormData & { captchaToken?: string }): Promise<AuthResult> {
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

      // Sign up with Supabase Auth (pass captchaToken if provided)
      // In development, skip CAPTCHA token to avoid Supabase verification errors
      // Cloudflare test keys generate tokens, but Supabase may not accept them
      const isDevelopment = process.env.NODE_ENV === "development";
      const signUpOptions: any = {
        data: {
          name: data.name || "",
          full_name: data.name || "",
        },
      };
      
      // Only include captchaToken in production (Supabase may require it there)
      // In development, skip it to avoid "captcha verification process failed" errors
      if (!isDevelopment && data.captchaToken) {
        signUpOptions.captchaToken = data.captchaToken;
      } else if (!isDevelopment && !data.captchaToken) {
        // In production, warn if CAPTCHA token is missing
        logger.warn("CAPTCHA token missing in production signup attempt");
      } else if (isDevelopment) {
        // In development, log that we're skipping CAPTCHA
        logger.info("Skipping CAPTCHA verification in development mode");
      }
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: signUpOptions,
      });

      if (authError || !authData.user) {
        // Log CAPTCHA errors for debugging
        if (authError && (authError.message?.toLowerCase().includes("captcha") || 
            authError.message?.toLowerCase().includes("turnstile") ||
            authError.message?.toLowerCase().includes("verification"))) {
          logger.warn("CAPTCHA verification error:", {
            message: authError.message,
            status: authError.status,
            hasCaptchaToken: !!data.captchaToken,
          });
        }
        
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

      // Create personal household automatically for new user
      // This allows users to immediately create accounts, transactions, budgets, and goals
      if (userData) {
        try {
          await this.createPersonalHousehold(authData.user.id, data.name ?? null);
          logger.info(`[AuthService] Personal household created for user ${authData.user.id}`);
        } catch (householdError) {
          logger.error("Error creating personal household during signup:", householdError);
          // Don't fail signup if household creation fails - it can be created later
        }
      }

      return { user: userData ? AuthMapper.toDomain(userData) : null, error: null };
    } catch (error) {
      logger.error("Error in signUp:", error);
      return { user: null, error: error instanceof Error ? error.message : "Failed to sign up" };
    }
  }

  /**
   * Create account and setup (user profile + household)
   * Used when creating account from Stripe checkout
   */
  async createAccountAndSetup(data: {
    userId: string;
    email: string;
    name?: string | null;
  }): Promise<{ success: boolean; user?: any; householdId?: string }> {
    try {
      // Create user profile
      const userResult = await this.createUserProfile({
        userId: data.userId,
        email: data.email,
        name: data.name,
      });

      if (!userResult.success || !userResult.user) {
        throw new Error("Failed to create user profile");
      }

      // Create personal household automatically (same as signup)
      await this.createPersonalHousehold(data.userId, data.name ?? null);

      // Get household ID
      const { getActiveHouseholdId } = await import("@/lib/utils/household");
      const householdId = await getActiveHouseholdId(data.userId);
      
      return {
        success: true,
        user: userResult.user,
        householdId: householdId || undefined,
      };
    } catch (error) {
      logger.error("[AuthService] Error in createAccountAndSetup:", error);
      throw error;
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

          // Create personal household automatically if it doesn't exist (edge case)
          // This ensures users always have a household, even if signup didn't complete properly
          try {
            await this.createPersonalHousehold(authData.user.id, authData.user.user_metadata?.name || null);
            logger.info(`[AuthService] Personal household created for user ${authData.user.id} during signin`);
          } catch (householdError) {
            logger.error("Error creating personal household during signin:", householdError);
            // Don't fail signin if household creation fails - it can be created later
          }
        } catch (error) {
          logger.error("Error creating user profile:", error);
          return { user: null, error: "Failed to create user profile" };
        }
      } else {
        // User exists - ensure household exists (edge case: user might not have household)
        try {
          const { getActiveHouseholdId } = await import("@/lib/utils/household");
          const householdId = await getActiveHouseholdId(authData.user.id);
          if (!householdId) {
            // No household found - create one
            await this.createPersonalHousehold(authData.user.id, userData.name ?? null);
            logger.info(`[AuthService] Personal household created for existing user ${authData.user.id} (edge case)`);
          }
        } catch (householdError) {
          logger.warn("Error checking/creating household during signin:", householdError);
          // Don't fail signin - household check is non-critical
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
   * Sign in with Google OAuth
   */
  async signInWithGoogle(redirectTo?: string): Promise<{ url: string | null; error: string | null }> {
    try {
      const supabase = await createServerClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com";
      const redirectUrl = redirectTo || `${appUrl}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        logger.error("Error initiating Google OAuth:", error);
        return { url: null, error: error.message || "Failed to sign in with Google" };
      }

      return { url: data.url, error: null };
    } catch (error) {
      logger.error("Error in signInWithGoogle:", error);
      return { url: null, error: error instanceof Error ? error.message : "Failed to sign in with Google" };
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
   * Uses service role client to bypass RLS during signup
   */
  private async createPersonalHousehold(userId: string, name: string | null): Promise<void> {
    const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
    const serviceRoleClient = createServiceRoleClient();
    const now = formatTimestamp(new Date());

    // Check if personal household already exists
    const { data: existingHousehold } = await serviceRoleClient
      .from("Household")
      .select("id")
      .eq("createdBy", userId)
      .eq("type", "personal")
      .maybeSingle();

    if (existingHousehold) {
      return;
    }

    // Create personal household using service role (bypasses RLS)
    const { data: household, error: householdError } = await serviceRoleClient
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

    // Create HouseholdMember using service role (bypasses RLS)
    const { error: memberError } = await serviceRoleClient
      .from("HouseholdMember")
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

    // Set as active household using service role (bypasses RLS)
    const { error: activeError } = await serviceRoleClient
      .from("UserActiveHousehold")
      .insert({
        userId: userId,
        householdId: household.id,
        updatedAt: now,
      });

    if (activeError) {
      logger.error("Error setting active household:", activeError);
    }

    // Create emergency fund goal for new user using service role (bypasses RLS)
    try {
      const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
      const serviceRoleClient = createServiceRoleClient();
      const goalNow = formatTimestamp(new Date());
      
      // Check if emergency fund goal already exists
      const { data: existingGoals } = await serviceRoleClient
        .from("Goal")
        .select("*")
        .eq("householdId", household.id)
        .eq("name", "Emergency Funds")
        .eq("isSystemGoal", true)
        .limit(1);

      if (!existingGoals || existingGoals.length === 0) {
        // Create emergency fund goal using service role (bypasses RLS)
        const { randomUUID } = await import("crypto");
        const goalId = randomUUID();
        
        const { error: goalError } = await serviceRoleClient
          .from("Goal")
          .insert({
            id: goalId,
            name: "Emergency Funds",
            targetAmount: 0.00,
            currentBalance: 0.00,
            incomePercentage: 0.00,
            priority: "High",
            description: "Emergency fund for unexpected expenses",
            isPaused: false,
            isCompleted: false,
            completedAt: null,
            expectedIncome: null,
            targetMonths: null,
            accountId: null,
            holdingId: null,
            isSystemGoal: true,
            userId: userId,
            householdId: household.id,
            createdAt: goalNow,
            updatedAt: goalNow,
          });

        if (goalError) {
          logger.error("Error creating emergency fund goal:", goalError);
        }
      }
    } catch (goalError) {
      logger.error("Error creating emergency fund goal:", goalError);
      // Don't fail if goal creation fails
    }
  }

  /**
   * Get session tokens - helper method to get access and refresh tokens
   */
  async getSessionTokens(): Promise<{ accessToken?: string; refreshToken?: string }> {
    try {
      const supabase = await createServerClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        return {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        };
      }
      
      return {};
    } catch (error) {
      logger.warn("[AuthService] Could not get session tokens:", error);
      return {};
    }
  }

  /**
   * Create user profile (bypasses RLS - used during signup)
   */
  async createUserProfile(data: {
    userId: string;
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
  }): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      // Check if user already exists
      const existingUser = await this.repository.findById(data.userId);
      
      if (existingUser) {
        return {
          success: true,
          message: "User profile already exists",
          user: existingUser,
        };
      }

      // Create user profile
      const userData = await this.repository.createUser({
        id: data.userId,
        email: data.email,
        name: data.name || null,
        role: "admin", // Owners who sign up directly are admins
      });

      // Create personal household automatically (same as signup/signin)
      try {
        await this.createPersonalHousehold(data.userId, data.name ?? null);
        logger.info(`[AuthService] Personal household created for user ${data.userId} during profile creation`);
      } catch (householdError) {
        logger.error("Error creating personal household during profile creation:", householdError);
        // Don't fail profile creation if household creation fails - it can be created later
      }

      return {
        success: true,
        message: "User profile created successfully",
        user: userData,
      };
    } catch (error: any) {
      logger.error("[AuthService] Error creating user profile:", error);

      // If it's a duplicate key error, try to fetch the existing user
      if (error.code === "23505" || 
          error.message?.includes("duplicate") || 
          error.message?.includes("unique")) {
        const existingUser = await this.repository.findById(data.userId);
        
        if (existingUser) {
          return {
            success: true,
            message: "User profile already exists (fetched after duplicate error)",
            user: existingUser,
          };
        }
      }

      throw new Error(`Failed to create user profile: ${error.message}`);
    }
  }

  /**
   * Send login OTP (validates credentials first)
   */
  async sendLoginOtp(data: { email: string; password: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createServerClient();

      // Validate credentials by attempting to sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError || !authData.user) {
        // Don't reveal if email exists or not for security
        return {
          success: false,
          error: "Invalid email or password",
        };
      }

      // Check if email is confirmed
      if (!authData.user.email_confirmed_at) {
        return {
          success: false,
          error: "Please confirm your email before signing in. Check your inbox for the confirmation link.",
        };
      }

      // Check if user is blocked
      const userData = await this.repository.findById(authData.user.id);
      if (userData) {
        // Note: isBlocked field might not exist in UserRow, we'll check via User table
        const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
        const serviceRoleClient = createServiceRoleClient();
        const { data: userCheck } = await serviceRoleClient
          .from("User")
          .select("isBlocked, role")
          .eq("id", authData.user.id)
          .single();

        if (userCheck?.isBlocked) {
          return {
            success: false,
            error: "Your account has been blocked. Please contact support.",
          };
        }
      }

      // Send OTP
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        logger.error("[AuthService] Error sending OTP:", otpError);
        return {
          success: false,
          error: "Failed to send OTP. Please try again.",
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      logger.error("[AuthService] Error in sendLoginOtp:", error);
      return {
        success: false,
        error: "An unexpected error occurred",
      };
    }
  }

  /**
   * Verify password for account deletion
   */
  async verifyPasswordForDeletion(password: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const supabase = await createServerClient();
      
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        return { valid: false, error: "Not authenticated" };
      }

      // Verify password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authUser.email!,
        password: password,
      });

      if (signInError) {
        return { valid: false, error: "Invalid password" };
      }

      return { valid: true };
    } catch (error) {
      logger.error("[AuthService] Error verifying password:", error);
      return { valid: false, error: "Failed to verify password" };
    }
  }

  /**
   * Update user_metadata in Supabase Auth with the name from User table
   * This ensures the Display name appears correctly in Supabase Auth dashboard
   */
  async updateUserMetadata(): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createServerClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        return { success: false, error: "Not authenticated" };
      }

      // Get user name from User table
      const userData = await this.repository.findById(authUser.id);
      if (!userData) {
        return { success: false, error: "User not found" };
      }

      // Update user_metadata in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          name: userData.name || "",
          full_name: userData.name || "",
        },
      });

      if (updateError) {
        logger.error("[AuthService] Error updating user metadata:", updateError);
        return { success: false, error: updateError.message || "Failed to update user metadata" };
      }

      return { success: true };
    } catch (error) {
      logger.error("[AuthService] Error in updateUserMetadata:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to update user metadata" };
    }
  }

  /**
   * Send OTP email for email verification (signup flow)
   * This is used to resend verification OTP after initial signup
   */
  async sendOtp(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Use anon client to send OTP (service role might not work correctly for OTP)
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      // Try to resend OTP with type "signup" first (for email verification)
      const { error: resendError } = await anonClient.auth.resend({
        type: "signup",
        email: email,
      });

      if (resendError) {
        // If resend fails, try signInWithOtp as fallback
        // This might be used if the user hasn't signed up yet or needs a new OTP
        const { error: otpError } = await anonClient.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true, // Allow creating user if doesn't exist
          },
        });

        if (otpError) {
          logger.error("[AuthService] Error sending OTP:", otpError);
          return {
            success: false,
            error: otpError.message || "Failed to send verification code",
          };
        }
      }

      return { success: true };
    } catch (error) {
      logger.error("[AuthService] Error in sendOtp:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send verification code",
      };
    }
  }

  /**
   * Sign in user for trusted browser (bypasses OTP)
   * Similar to signIn but returns session data for cookie setting
   */
  async loginTrusted(data: { email: string; password: string }): Promise<{
    success: boolean;
    user?: BaseUser;
    session?: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    error?: string;
  }> {
    try {
      const supabase = await createServerClient();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError || !authData.user) {
        const errorMessage = getAuthErrorMessage(authError, "Failed to sign in");
        return { success: false, error: errorMessage };
      }

      // Check if user is blocked (if property exists)
      if ('banned_until' in authData.user && (authData.user as any).banned_until) {
        return { success: false, error: "Your account has been blocked. Please contact support." };
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

          // Create personal household automatically
          try {
            await this.createPersonalHousehold(authData.user.id, authData.user.user_metadata?.name || null);
            logger.info(`[AuthService] Personal household created for user ${authData.user.id} during trusted login`);
          } catch (householdError) {
            logger.error("Error creating personal household during trusted login:", householdError);
          }
        } catch (error) {
          logger.error("Error creating user profile:", error);
          return { success: false, error: "Failed to create user profile" };
        }
      }

      // Get session data
      const { data: { session } } = await supabase.auth.getSession();

      return {
        success: true,
        user: AuthMapper.toDomain(userData),
        session: session ? {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in || 3600,
        } : undefined,
      };
    } catch (error) {
      logger.error("Error in loginTrusted:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to sign in" };
    }
  }

  /**
   * Sync client-side session with server-side cookies
   * This ensures that cookies are properly set on the server before redirecting
   * Important in production where cookie settings (secure, sameSite, domain) need to be consistent
   */
  async syncSession(): Promise<{
    success: boolean;
    user?: BaseUser;
    session?: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    warning?: string;
  }> {
    try {
      const supabase = await createServerClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();

      if (sessionError || userError || !authUser) {
        return { success: false };
      }

      // Get user profile from repository
      const userData = await this.repository.findById(authUser.id);
      if (!userData) {
        return {
          success: false,
          warning: "User profile not found",
        };
      }

      const result: {
        success: boolean;
        user?: BaseUser;
        session?: {
          access_token: string;
          refresh_token: string;
          expires_in: number;
        };
        warning?: string;
      } = {
        success: true,
        user: AuthMapper.toDomain(userData),
      };

      // Include session data if available
      if (session) {
        result.session = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in || 3600,
        };
      }

      return result;
    } catch (error) {
      logger.error("[AuthService] Error in syncSession:", error);
      return { success: false };
    }
  }

  /**
   * Find user by ID
   */
  async findUserById(userId: string): Promise<BaseUser | null> {
    const userRow = await this.repository.findById(userId);
    if (!userRow) {
      return null;
    }
    return AuthMapper.toDomain(userRow);
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<BaseUser | null> {
    const userRow = await this.repository.findByEmail(email);
    if (!userRow) {
      return null;
    }
    return AuthMapper.toDomain(userRow);
  }

  /**
   * Find users created between dates (for batch operations like welcome emails)
   */
  async findUsersByDateRange(startDate: Date, endDate: Date): Promise<BaseUser[]> {
    const userRows = await this.repository.findUsersByDateRange(startDate, endDate);
    return userRows.map(row => AuthMapper.toDomain(row));
  }
}

