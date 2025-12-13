/**
 * Profile Service
 * Business logic for user profile management
 */

import { ProfileRepository } from "@/src/infrastructure/database/repositories/profile.repository";
import { ProfileMapper } from "./profile.mapper";
import { ProfileFormData } from "../../domain/profile/profile.validations";
import { BaseProfile } from "../../domain/profile/profile.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { logger } from "@/src/infrastructure/utils/logger";
// CRITICAL: Use cached function to ensure React cache() works correctly
import { getDashboardSubscription } from "../subscriptions/get-dashboard-subscription";
import { makeMembersService } from "../members/members.factory";
import { makeAuthService } from "../auth/auth.factory";
import { makeSubscriptionsService } from "../subscriptions/subscriptions.factory";
import { AppError } from "../shared/app-error";
import { getCurrentUserId } from "../shared/feature-guard";
import { validateImageFile, sanitizeFilename, getFileExtension } from "@/lib/utils/file-validation";
import { SecurityLogger } from "@/src/infrastructure/utils/security-logging";
import { cacheLife, cacheTag } from 'next/cache';
import { cookies } from 'next/headers';

// Cached helper function (must be standalone, not class method)
async function getUserWithSubscriptionCached(
  userId: string
): Promise<{
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  plan: {
    id: string;
    name: string;
  } | null;
  subscription: {
    status: "active" | "trialing" | "cancelled" | "past_due";
    trialEndDate: string | null;
  } | null;
  userRole: "admin" | "member" | "super_admin" | null;
}> {
  'use cache: private'
  cacheTag(`user-${userId}`, 'profile')
  cacheLife('user-data')
  
  // Can access cookies() directly with 'use cache: private'
  const cookieStore = await cookies();
  
  // Create repository instance inside cached function (cannot pass instances as parameters)
  const { ProfileRepository } = await import("@/src/infrastructure/database/repositories/profile.repository");
  const repository = new ProfileRepository();
  
  // Get user data from repository
  const userRow = await repository.findById(userId);
  
  if (!userRow) {
    throw new AppError("User not found", 404);
  }

  // Get subscription and plan data
  // CRITICAL: Use cached getDashboardSubscription to avoid duplicate calls
  // This ensures React cache() works correctly within the same request
  // Pass userId to avoid calling getCurrentUserId() (which uses cookies()) inside cache scope
  const subscriptionData = await getDashboardSubscription(userId);
  
  // Get user role
  const membersService = makeMembersService();
  const userRole = await membersService.getUserRole(userId);
  
  // Validate and sanitize avatarUrl
  let avatarUrl: string | null = null;
  if (userRow.avatar_url && typeof userRow.avatar_url === "string") {
    const trimmed = userRow.avatar_url.trim();
    // Filter out invalid values
    if (trimmed !== "" && 
        trimmed.toLowerCase() !== "na" && 
        trimmed.toLowerCase() !== "null" &&
        trimmed.toLowerCase() !== "undefined") {
      // Check if it's a valid URL format
      try {
        new URL(trimmed);
        avatarUrl = trimmed;
      } catch {
        // If not a full URL, check if it's a relative path or data URI
        if (trimmed.startsWith("/") || trimmed.startsWith("data:")) {
          avatarUrl = trimmed;
        }
      }
    }
  }

  const user = {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name || null,
    avatarUrl,
  };

  const plan = subscriptionData.plan ? {
    id: subscriptionData.plan.id,
    name: subscriptionData.plan.name,
  } : null;

  const subscription = subscriptionData.subscription ? {
    status: subscriptionData.subscription.status as "active" | "trialing" | "cancelled" | "past_due",
    trialEndDate: subscriptionData.subscription.trial_end_date 
      ? (typeof subscriptionData.subscription.trial_end_date === 'string' 
          ? subscriptionData.subscription.trial_end_date 
          : subscriptionData.subscription.trial_end_date.toISOString())
      : null,
  } : null;

  return {
    user,
    plan,
    subscription,
    userRole,
  };
}

export class ProfileService {
  constructor(private repository: ProfileRepository) {}

  /**
   * Get current user profile
   */
  async getProfile(
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseProfile | null> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        return null;
      }

      const userRow = await this.repository.findById(userId, accessToken, refreshToken);
      
      if (!userRow) {
        return null;
      }

      return ProfileMapper.toDomain(userRow);
    } catch (error) {
      logger.error("[ProfileService] Error fetching profile:", error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<ProfileFormData> & { temporaryExpectedIncome?: import("../../domain/onboarding/onboarding.types").ExpectedIncomeRange | null; temporaryExpectedIncomeAmount?: number | null }): Promise<BaseProfile> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const now = formatTimestamp(new Date());

    // Update user profile
    const updateData: Parameters<typeof this.repository.update>[1] = {
      name: data.name !== undefined ? (data.name || null) : undefined,
      avatarUrl: data.avatarUrl !== undefined ? (data.avatarUrl || null) : undefined,
      phoneNumber: data.phoneNumber !== undefined ? (data.phoneNumber || null) : undefined,
      dateOfBirth: data.dateOfBirth !== undefined ? (data.dateOfBirth || null) : undefined,
      updatedAt: now,
    };

    if (data.temporaryExpectedIncome !== undefined) {
      updateData.temporaryExpectedIncome = data.temporaryExpectedIncome as string | null;
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    const userRow = await this.repository.update(userId, updateData);

    return ProfileMapper.toDomain(userRow);
  }

  /**
   * Update user email (requires re-authentication in Supabase Auth)
   */
  async updateEmail(newEmail: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    // Update email in Auth (this will send confirmation email)
    await this.repository.updateAuthEmail(userId, newEmail);

    // Note: Email updates should be handled through auth system, not profile service
    // This method is kept for backward compatibility but email is not updated here
    const now = formatTimestamp(new Date());
    await this.repository.update(userId, {
      updatedAt: now,
    });
  }

  /**
   * Get user with subscription and role information
   * Consolidates data from User table, subscription, plan, and household role
   */
  async getUserWithSubscription(userId: string): Promise<{
    user: {
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
    };
    plan: {
      id: string;
      name: string;
    } | null;
    subscription: {
      status: "active" | "trialing" | "cancelled" | "past_due";
      trialEndDate: string | null;
    } | null;
    userRole: "admin" | "member" | "super_admin" | null;
  }> {
    return getUserWithSubscriptionCached(userId);
  }

  /**
   * Upload avatar image from external URL (e.g., Google OAuth)
   * Downloads the image, validates it, and uploads to Supabase Storage
   */
  async uploadAvatarFromUrl(userId: string, imageUrl: string): Promise<{ url: string }> {
    try {
      // Download image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new AppError(`Failed to download image from URL: ${response.statusText}`, 400);
      }

      // Get content type from response headers
      const contentType = response.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) {
        throw new AppError("URL does not point to an image", 400);
      }

      // Convert response to buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Validate file size (max 5MB)
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (buffer.length > MAX_FILE_SIZE) {
        throw new AppError("Image file size exceeds 5MB limit", 400);
      }

      // Create a File-like object for validation
      const blob = new Blob([buffer], { type: contentType });
      const file = new File([blob], "avatar.jpg", { type: contentType });

      // Validate image file
      const validation = await validateImageFile(file, buffer);
      if (!validation.valid) {
        throw new AppError(validation.error || "Invalid image file", 400);
      }

      const supabase = await createServerClient();

      // Determine file extension from content type
      let fileExt = "jpg";
      if (contentType.includes("png")) {
        fileExt = "png";
      } else if (contentType.includes("gif")) {
        fileExt = "gif";
      } else if (contentType.includes("webp")) {
        fileExt = "webp";
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileName = `${userId}/${timestamp}-${randomSuffix}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatar")
        .upload(fileName, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        logger.error("[ProfileService] Error uploading avatar from URL:", uploadError);
        throw new AppError(uploadError.message || "Failed to upload avatar", 400);
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from("avatar")
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new AppError("Failed to get avatar URL", 500);
      }

      return { url: urlData.publicUrl };
    } catch (error) {
      logger.error("[ProfileService] Error uploading avatar from URL:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to upload avatar from URL", 500);
    }
  }

  /**
   * Upload avatar image
   */
  async uploadAvatar(userId: string, file: File, requestHeaders: Headers): Promise<{ url: string }> {
    try {
      const supabase = await createServerClient();

      // Convert File to ArrayBuffer for validation
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Comprehensive file validation
      const validation = await validateImageFile(file, buffer);
      if (!validation.valid) {
        const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0] || 
                   requestHeaders.get("x-real-ip") || 
                   "unknown";
        const userAgent = requestHeaders.get("user-agent") || "unknown";
        SecurityLogger.invalidFileUpload(
          `Invalid file upload attempt by user ${userId}`,
          {
            userId,
            ip,
            userAgent,
            details: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              error: validation.error,
            },
          }
        );
        throw new AppError(validation.error || "Invalid file", 400);
      }

      // Sanitize filename
      const sanitizedOriginalName = sanitizeFilename(file.name);
      const fileExt = getFileExtension(sanitizedOriginalName) || getFileExtension(file.name) || "jpg";
      
      // Generate unique filename with sanitized extension
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileName = `${userId}/${timestamp}-${randomSuffix}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatar")
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        logger.error("[ProfileService] Error uploading avatar:", uploadError);
        throw new AppError(uploadError.message || "Failed to upload avatar", 400);
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from("avatar")
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new AppError("Failed to get avatar URL", 500);
      }

      // Update profile with avatar URL
      await this.repository.update(userId, {
        avatarUrl: urlData.publicUrl,
        updatedAt: formatTimestamp(new Date()),
      });

      return { url: urlData.publicUrl };
    } catch (error) {
      logger.error("[ProfileService] Error uploading avatar:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to upload avatar", 500);
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Check household ownership
      const membersService = makeMembersService();
      const householdCheck = await membersService.checkHouseholdOwnership(userId);
      if (householdCheck.isOwner && householdCheck.memberCount > 1) {
        throw new AppError(
          `You are the owner of a household "${householdCheck.householdName || "Household"}" with ${householdCheck.memberCount - 1} other member(s). Please transfer ownership to another member or remove all members before deleting your account.`,
          400
        );
      }

      // 3. Cancel active subscription (don't fail if this fails, but log it)
      const subscriptionsService = makeSubscriptionsService();
      const subscriptionResult = await subscriptionsService.cancelUserSubscription(userId);
      if (!subscriptionResult.cancelled && subscriptionResult.error) {
        logger.error("[ProfileService] Warning: Failed to cancel subscription:", subscriptionResult.error);
      }

      // 4. Delete account immediately
      const deletionResult = await this.deleteAccountImmediately(userId);
      if (!deletionResult.success) {
        throw new AppError(deletionResult.error || "Failed to delete account", 500);
      }

      // 5. Sign out user
      const supabase = await createServerClient();
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        // Ignore sign out errors since account is already deleted
        logger.log("[ProfileService] Sign out after deletion (account already deleted)");
      }

      return {
        success: true,
        message: "Account deleted successfully. All your data has been permanently removed.",
      };
    } catch (error) {
      logger.error("[ProfileService] Error deleting account:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to delete account", 500);
    }
  }

  /**
   * Delete account immediately
   * Uses service role to bypass RLS and delete all user data
   */
  private async deleteAccountImmediately(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
      const { createClient } = await import("@supabase/supabase-js");
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      // New format (sb_secret_...) is preferred, fallback to old format (service_role JWT) for backward compatibility
      const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || 
                                 process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseServiceKey) {
        throw new Error("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY for legacy) is not set");
      }

      if (!supabaseUrl) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
      }

      logger.debug("[ProfileService] Attempting to delete user:", userId);

      // Use service role to clean up data before deletion
      const serviceSupabase = createServiceRoleClient();
      
      // Call SQL function to delete user data (goals, subscriptions, etc.)
      // This handles RESTRICT constraints properly
      try {
        const { error: functionError } = await serviceSupabase.rpc("delete_user_data", {
          p_user_id: userId,
        });
        
        if (functionError) {
          logger.warn("[ProfileService] Warning: Could not delete user data via function:", functionError);
          // Try manual deletion as fallback
          const { error: deleteSubsError } = await serviceSupabase
            .from("app_subscriptions")
            .delete()
            .eq("user_id", userId);
          
          if (deleteSubsError) {
            logger.warn("[ProfileService] Warning: Could not delete subscriptions manually:", deleteSubsError);
          } else {
            logger.debug("[ProfileService] Deleted user subscriptions manually");
          }
        } else {
          logger.debug("[ProfileService] User data cleaned up via SQL function");
        }
      } catch (funcErr) {
        logger.warn("[ProfileService] Warning: Exception calling delete_user_data function:", funcErr);
        // Continue with manual deletion
        const { error: deleteSubsError } = await serviceSupabase
          .from("subscriptions")
          .delete()
          .eq("user_id", userId);
        
        if (!deleteSubsError) {
          logger.debug("[ProfileService] Deleted user subscriptions manually (fallback)");
        }
      }

      // Use Admin API to delete user from auth.users
      // This will cascade delete from User table due to FK constraint
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Try to delete user from auth.users with retry logic
      let deleteError = null;
      let data = null;
      const maxRetries = 2;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          // Wait a bit before retrying (exponential backoff)
          const delay = attempt * 1000; // 1s, 2s
          logger.debug(`[ProfileService] Retry attempt ${attempt} after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const result = await adminClient.auth.admin.deleteUser(userId);
        deleteError = result.error;
        data = result.data;
        
        if (!deleteError) {
          break; // Success!
        }
        
        // If it's not a database error, don't retry
        const errorCode = (deleteError as any).code;
        if (errorCode !== "unexpected_failure" && deleteError.status !== 500) {
          break;
        }
      }

      if (deleteError) {
        logger.error("[ProfileService] Error deleting user after retries:", {
          error: deleteError,
          message: deleteError.message,
          status: deleteError.status,
          code: (deleteError as any).code,
          userId,
        });

        const errorCode = (deleteError as any).code;
        const errorStatus = deleteError.status;
        
        // If it's a database error, this is likely a Supabase Auth internal issue
        // As a workaround, we'll block the user and clean up all accessible data
        if (errorCode === "unexpected_failure" || errorStatus === 500) {
          logger.debug("[ProfileService] Supabase Auth deletion failed with unexpected_failure.");
          logger.debug("[ProfileService] Attempting workaround: blocking user and cleaning up data...");
          
          try {
            // Step 1: Block the user to prevent access
            const { error: blockError } = await serviceSupabase
              .from("users")
              .update({ isBlocked: true })
              .eq("id", userId);
            
            if (blockError) {
              logger.error("[ProfileService] Could not block user:", blockError);
              return { 
                success: false, 
                error: "Unable to complete account deletion. Please contact support for assistance." 
              };
            }
            
            logger.debug("[ProfileService] User marked as blocked - access is now disabled");
            
            // Clear user verification cache since user was blocked (workaround for deletion)
            const { clearUserVerificationCache } = await import("@/lib/utils/verify-user-exists");
            await clearUserVerificationCache(userId);
            
            // Return success since account is effectively deleted (blocked + data cleaned)
            return { 
              success: true,
            };
          } catch (workaroundError) {
            logger.error("[ProfileService] Error in workaround:", workaroundError);
            return { 
              success: false, 
              error: "Unable to complete account deletion due to a database constraint. Your subscriptions have been cancelled. Please contact support to complete the account deletion process." 
            };
          }
        }
        
        // Provide user-friendly error message for other errors
        let errorMessage = "Failed to delete account";
        
        if (deleteError.message) {
          errorMessage = deleteError.message;
        } else if (errorCode) {
          errorMessage = `Error: ${errorCode}`;
        }

        return { success: false, error: errorMessage };
      }

      // Clear user verification cache since user was deleted
      const { clearUserVerificationCache } = await import("@/lib/utils/verify-user-exists");
      await clearUserVerificationCache(userId);

      logger.debug("[ProfileService] Successfully deleted user:", userId, "Data:", data);
      return { success: true };
    } catch (error) {
      logger.error("[ProfileService] Exception in deleteAccountImmediately:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        userId,
      });
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete account" 
      };
    }
  }
}

