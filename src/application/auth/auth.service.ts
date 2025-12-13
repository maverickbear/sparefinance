/**
 * Auth Service
 * Business logic for authentication
 */

import { IAuthRepository } from "@/src/infrastructure/database/repositories/interfaces/auth.repository.interface";
import { AuthMapper } from "./auth.mapper";
import { SignUpFormData, SignInFormData, ForgotPasswordFormData, ResetPasswordFormData, ChangePasswordFormData } from "../../domain/auth/auth.validations";
import { BaseUser, AuthResult } from "../../domain/auth/auth.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { logger } from "@/src/infrastructure/utils/logger";
import { PASSWORD_RESET_TOKEN_TTL_MS } from "@/src/domain/shared/constants";

export class AuthService {
  constructor(private repository: IAuthRepository) {}

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
      const signUpOptions: any = {
        data: {
          name: data.name || "",
          full_name: data.name || "",
        },
      };
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: signUpOptions,
      });

      if (authError || !authData.user) {
        
        const errorMessage = getAuthErrorMessage(authError, "Failed to sign up");
        return { user: null, error: errorMessage };
      }

      let userData: any = await this.repository.findById(authData.user.id);
      
      if (!userData) {
        try {
          userData = await this.repository.createUser({
            id: authData.user.id,
            email: authData.user.email!,
            name: data.name || null,
            role: "admin",
          });
          logger.info(`[AuthService] User profile created for ${authData.user.id}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const errorCode = (error as any)?.code;
          
          // If user is not available in auth.users yet (timing issue or email confirmation required)
          if (errorMessage.includes("not available in auth.users") || 
              errorMessage.includes("23503") ||
              errorCode === '23503') {
            logger.info("[AuthService] User profile will be created after email confirmation or when user is available in auth.users");
            
            // Check if email confirmation is required
            // If the user was just created but not confirmed, we should still return success
            // The profile will be created when they confirm their email
            if (!authData.user.email_confirmed_at) {
              logger.info("[AuthService] Email confirmation required - profile will be created after confirmation");
              // Return success but without userData - the profile will be created later
              return { 
                user: null, 
                error: null,
                requiresEmailConfirmation: true 
              };
            }
            
            // If email is confirmed but user still not in auth.users, this is a real error
            logger.error("[AuthService] User email is confirmed but profile creation failed:", error);
            return {
              user: null,
              error: "Account created but profile setup failed. Please try signing in or contact support if the issue persists."
            };
          }
          
          // For other errors (like duplicate email), return the error
          logger.error("Error creating user profile:", error);
          
          // Check if it's a duplicate email error
          if (errorCode === '23505' || errorMessage.includes("duplicate") || errorMessage.includes("unique")) {
            return {
              user: null,
              error: "An account with this email already exists. Please sign in instead."
            };
          }
          
          return {
            user: null,
            error: "Failed to create user profile. Please try again or contact support."
          };
        }
      } else {
        logger.info(`[AuthService] User profile already exists for ${authData.user.id}`);
      }

      if (userData) {
        try {
          // Create Stripe Customer immediately after signup (new flow)
          try {
            const { makeStripeService } = await import("../stripe/stripe.factory");
            const stripeService = makeStripeService();
            const { customerId } = await stripeService.createOrGetStripeCustomer(
              authData.user.id,
              authData.user.email!,
              data.name || null,
              null // householdId will be set after household creation
            );
            logger.info(`[AuthService] Stripe customer created/retrieved for user ${authData.user.id}:`, customerId);
          } catch (stripeError) {
            // Don't fail signup if Stripe customer creation fails - it can be created later
            logger.error("[AuthService] Error creating Stripe customer during signup (non-critical):", stripeError);
          }

          // Publish UserCreated event to create household
          const { getEventBus } = await import("../events/events.factory");
          const eventBus = getEventBus();
          
          const userCreatedEvent: import("@/src/domain/events/domain-events.types").UserCreatedEvent = {
            eventType: 'UserCreated',
            occurredAt: new Date(),
            aggregateId: authData.user.id,
            userId: authData.user.id,
            email: authData.user.email!,
            name: data.name || null,
          };
          
          await eventBus.publish(userCreatedEvent);
          logger.info(`[AuthService] UserCreated event published and processed for user ${authData.user.id}`);
        } catch (householdError) {
          logger.error("Error processing UserCreated event during signup:", householdError);
          return {
            user: null,
            error: `Failed to complete signup: ${householdError instanceof Error ? householdError.message : "Unknown error"}. Please contact support.`,
          };
        }
      }

      return { user: userData ? AuthMapper.toDomain(userData) : null, error: null };
    } catch (error) {
      logger.error("Error in signUp:", error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code;
      
      if (errorCode === '23505' || errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
        return { 
          user: null, 
          error: "An account with this email already exists. Please sign in instead." 
        };
      }
      
      return { user: null, error: error instanceof Error ? error.message : "Failed to sign up" };
    }
  }

  async createAccountAndSetup(data: {
    userId: string;
    email: string;
    name?: string | null;
  }): Promise<{ success: boolean; user?: any; householdId?: string }> {
    try {
      const userResult = await this.createUserProfile({
        userId: data.userId,
        email: data.email,
        name: data.name,
      });

      if (!userResult.success || !userResult.user) {
        throw new Error("Failed to create user profile");
      }

      try {
        await this.createPersonalHouseholdAtomic(data.userId, data.name ?? null);
      } catch (householdError) {
        logger.error("Error creating personal household during account setup:", householdError);
        throw new Error(
          `Failed to create personal household: ${householdError instanceof Error ? householdError.message : "Unknown error"}`
        );
      }

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
   * If session doesn't exist, treat as success (logout already achieved)
   */
  async signOut(): Promise<{ error: string | null }> {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.auth.signOut();
      
      // If session doesn't exist, that's fine - logout is already achieved
      if (error) {
        const errorMessage = error.message?.toLowerCase() || "";
        const errorCode = (error as any)?.code?.toLowerCase() || "";
        
        // Check if it's a "session not found" error
        const isSessionNotFound = 
          errorCode === "session_not_found" ||
          errorMessage.includes("session not found") ||
          errorMessage.includes("session id") && errorMessage.includes("doesn't exist") ||
          errorMessage.includes("doesn't exist");
        
        if (isSessionNotFound) {
          // Session already doesn't exist - logout is successful
          logger.info("Session not found during signOut - logout already achieved");
          return { error: null };
        }
        
        // Other errors should be reported
        return { error: error.message };
      }
      
      return { error: null };
    } catch (error) {
      logger.error("Error in signOut:", error);
      
      // Check if it's a session-related error
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      if (errorMessage.includes("session not found") || 
          errorMessage.includes("session id") && errorMessage.includes("doesn't exist")) {
        // Session already doesn't exist - logout is successful
        logger.info("Session not found during signOut (catch) - logout already achieved");
        return { error: null };
      }
      
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
   * Validates token TTL and password strength before resetting
   */
  async resetPassword(data: ResetPasswordFormData): Promise<{ error: string | null }> {
    try {
      const supabase = await createServerClient();

      // Get current session to validate token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        return { error: "Invalid or expired password reset token. Please request a new password reset." };
      }

      // Validate token TTL (Supabase tokens expire after 1 hour by default)
      // Check if token was issued more than 1 hour ago
      const tokenIssuedAt = session.expires_at ? new Date(session.expires_at * 1000 - PASSWORD_RESET_TOKEN_TTL_MS) : null;
      const now = new Date();

      if (tokenIssuedAt) {
        const tokenAge = now.getTime() - tokenIssuedAt.getTime();
        if (tokenAge > PASSWORD_RESET_TOKEN_TTL_MS) {
          logger.warn("[AuthService] Password reset token expired:", { 
            tokenAge: tokenAge, 
            maxAge: PASSWORD_RESET_TOKEN_TTL_MS 
          });
          return { error: "Password reset token has expired. Please request a new password reset." };
        }
      }

      // Check password against HIBP
      const passwordValidation = await validatePasswordAgainstHIBP(data.password);
      if (!passwordValidation.isValid) {
        return { error: passwordValidation.error || "Invalid password" };
      }

      // Update password (Supabase will also validate token expiration)
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        // Check if error is due to expired token
        const errorMessage = error.message?.toLowerCase() || "";
        if (errorMessage.includes("expired") || errorMessage.includes("invalid") || errorMessage.includes("token")) {
          return { error: "Password reset token has expired. Please request a new password reset." };
        }
        return { error: getAuthErrorMessage(error, "Failed to reset password") };
      }

      return { error: null };
    } catch (error) {
      logger.error("Error in resetPassword:", error);
      
      // Check if error is related to token expiration
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      if (errorMessage.includes("expired") || errorMessage.includes("invalid") || errorMessage.includes("token")) {
        return { error: "Password reset token has expired. Please request a new password reset." };
      }
      
      return { error: error instanceof Error ? error.message : "Failed to reset password" };
    }
  }

  /**
   * Sign in with Google OAuth
   * @param redirectTo - The callback URL after OAuth
   * @param flow - "signin" or "signup" to determine the OAuth prompt behavior
   */
  async signInWithGoogle(redirectTo?: string, flow?: "signin" | "signup"): Promise<{ url: string | null; error: string | null }> {
    try {
      const supabase = await createServerClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com";
      const redirectUrl = redirectTo || `${appUrl}/auth/callback`;

      // For signup, use "select_account consent" to force account selection and consent screen
      // This prevents Google from showing "You're signing back in" message
      // For signin, use "consent" to just show consent screen
      const prompt = flow === "signup" ? "select_account consent" : "consent";

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: prompt,
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
   * Helper: Publish UserCreated event to trigger household and goal creation
   * This decouples AuthService from Household and Goal domains
   * @deprecated Use publishUserCreatedEvent instead for better decoupling
   */
  private async createPersonalHouseholdAtomic(userId: string, name: string | null): Promise<string> {
    return this.publishUserCreatedEvent(userId, userId, name);
  }

  /**
   * Helper: Publish UserCreated event to trigger household and goal creation
   * Uses event bus to decouple AuthService from Household and Goal domains
   * This ensures all operations (Household, HouseholdMember, UserActiveHousehold, Goal) succeed or fail together
   */
  private async publishUserCreatedEvent(userId: string, email: string, name: string | null): Promise<string> {
    const { getEventBus } = await import("../events/events.factory");
    const eventBus = getEventBus();
    
    const userCreatedEvent: import("@/src/domain/events/domain-events.types").UserCreatedEvent = {
      eventType: 'UserCreated',
      occurredAt: new Date(),
      aggregateId: userId,
      userId: userId,
      email: email,
      name: name,
    };
    
    // Publish event and wait for handlers to complete
    // If handler fails, this throws (ensures data consistency)
    await eventBus.publish(userCreatedEvent);
    
    // Get household ID from the result (handler returns it via the SQL function)
    // For now, we'll query it - in a more sophisticated system, the event could include it
    const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
    const serviceRoleClient = createServiceRoleClient();
    const { data: household } = await serviceRoleClient
      .from("households")
      .select("id")
      .eq("created_by", userId)
      .eq("type", "personal")
      .maybeSingle();
    
    if (!household) {
      throw new Error("Failed to create personal household: household not found after event processing");
    }
    
    logger.info(`[AuthService] UserCreated event processed for user ${userId}, household ID: ${household.id}`);
    return household.id;
  }

  /**
   * Helper: Create personal household for new user
   * Uses service role client to bypass RLS during signup
   * @deprecated Use createPersonalHouseholdAtomic instead for atomic transactions
   */
  private async createPersonalHousehold(userId: string, name: string | null): Promise<void> {
    const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
    const serviceRoleClient = createServiceRoleClient();
    const now = formatTimestamp(new Date());

    // Check if personal household already exists
    const { data: existingHousehold } = await serviceRoleClient
      .from("households")
      .select("id")
      .eq("created_by", userId)
      .eq("type", "personal")
      .maybeSingle();

    if (existingHousehold) {
      return;
    }

    // Create personal household using service role (bypasses RLS)
    const { data: household, error: householdError } = await serviceRoleClient
      .from("households")
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
      .from("household_members")
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
      .from("system_user_active_households")
      .insert({
        userId: userId,
        householdId: household.id,
        updatedAt: now,
      });

    if (activeError) {
      logger.error("Error setting active household:", activeError);
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

      // Handle avatar upload from Google OAuth if provided
      let finalAvatarUrl: string | null = null;
      if (data.avatarUrl) {
        try {
          // Check if it's an external URL (Google OAuth)
          const isExternalUrl = data.avatarUrl.startsWith("http://") || data.avatarUrl.startsWith("https://");
          if (isExternalUrl) {
            // Import ProfileService to upload avatar from URL
            const { makeProfileService } = await import("../profile/profile.factory");
            const profileService = makeProfileService();
            
            // Download and upload avatar to Supabase Storage
            const uploadResult = await profileService.uploadAvatarFromUrl(data.userId, data.avatarUrl);
            finalAvatarUrl = uploadResult.url;
            logger.info(`[AuthService] Avatar uploaded from Google OAuth for user ${data.userId}`);
          } else {
            // Already a Supabase URL, use as is
            finalAvatarUrl = data.avatarUrl;
          }
        } catch (avatarError) {
          // Log error but don't fail profile creation
          logger.error("[AuthService] Error uploading avatar from Google OAuth:", avatarError);
          // Continue without avatar - user can upload later
        }
      }

      // Create user profile
      const userData = await this.repository.createUser({
        id: data.userId,
        email: data.email,
        name: data.name || null,
        role: "admin", // Owners who sign up directly are admins
      });

      // Update profile with avatar URL if we have one
      // We update after creation because createUser doesn't accept avatarUrl
      if (finalAvatarUrl) {
        try {
          const { ProfileRepository } = await import("@/src/infrastructure/database/repositories/profile.repository");
          const profileRepository = new ProfileRepository();
          await profileRepository.update(data.userId, {
            avatarUrl: finalAvatarUrl,
            updatedAt: formatTimestamp(new Date()),
          });
          logger.info(`[AuthService] Avatar URL updated for user ${data.userId}`);
          
          // Update userData to include avatar_url for return value
          userData.avatar_url = finalAvatarUrl;
        } catch (avatarUpdateError) {
          // Log error but don't fail - avatar can be updated later
          logger.error("[AuthService] Error updating avatar URL:", avatarUpdateError);
        }
      }

      // Create personal household automatically (same as signup/signin)
      // Use atomic method to ensure consistency
      try {
        await this.createPersonalHouseholdAtomic(data.userId, data.name ?? null);
        logger.info(`[AuthService] Personal household created atomically for user ${data.userId} during profile creation`);
      } catch (householdError) {
        logger.error("Error creating personal household during profile creation:", householdError);
        // For profile creation, we allow it to continue - household can be created later
        // This is less critical than signup since profile creation happens in various contexts
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
          .from("users")
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
      // New format (sb_publishable_...) is preferred, fallback to old format (anon JWT) for backward compatibility
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseAnonKey) {
        throw new Error("Missing Supabase API key configuration");
      }
      
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

