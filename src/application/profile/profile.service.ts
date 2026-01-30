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

      // 2. Disconnect all Plaid items (skipped - support removed)
      logger.info("[ProfileService] Plaid disconnection skipped (feature disabled)", { userId });

      // 3. Cancel active subscription in Stripe (don't fail if this fails, but log it)
      const subscriptionsService = makeSubscriptionsService();
      const subscriptionResult = await subscriptionsService.cancelUserSubscription(userId);
      if (subscriptionResult.cancelled) {
        logger.info("[ProfileService] Successfully cancelled Stripe subscription for user", { userId });
      } else {
        logger.error("[ProfileService] Warning: Failed to cancel Stripe subscription:", {
          userId,
          error: subscriptionResult.error,
        });
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
        message: "Account deleted successfully. Your personal information has been anonymized and your account has been deactivated. Some records required by law may be retained for compliance purposes.",
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
   * Delete account immediately using soft delete + PII anonymization
   * Uses service role to bypass RLS and anonymize user data
   * Maintains fiscal/legal records while removing personal information
   */
  private async deleteAccountImmediately(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
      const { makeProfileAnonymizationService } = await import("./profile.factory");

      logger.debug("[ProfileService] Attempting to soft delete and anonymize user:", userId);

      // Use service role to access data
      const serviceSupabase = createServiceRoleClient();
      
      // Step 1: Anonymize user PII using SQL function
      // This anonymizes name, email, phone, date_of_birth, avatar_url
      // and sets deleted_at timestamp
      const anonymizationService = makeProfileAnonymizationService();
      try {
        await anonymizationService.anonymizeUserPII(userId);
        logger.info("[ProfileService] Successfully anonymized user PII", { userId });
      } catch (anonError) {
        logger.error("[ProfileService] Error anonymizing user PII:", {
          userId,
          error: anonError instanceof Error ? anonError.message : "Unknown error",
        });
        // Continue with deletion even if anonymization fails partially
      }

      // Step 2: Revoke all sessions
      try {
        await anonymizationService.revokeAllSessions(userId);
      } catch (sessionError) {
        logger.warn("[ProfileService] Warning: Could not revoke all sessions:", {
          userId,
          error: sessionError instanceof Error ? sessionError.message : "Unknown error",
        });
        // Continue - session revocation is not critical
      }

      // Step 3: Revoke all external tokens (Plaid, etc.)
      try {
        await anonymizationService.revokeAllTokens(userId);
      } catch (tokenError) {
        logger.warn("[ProfileService] Warning: Could not revoke all tokens:", {
          userId,
          error: tokenError instanceof Error ? tokenError.message : "Unknown error",
        });
        // Continue - token revocation is handled by PlaidService
      }

      // Step 4: Verify that anonymization was successful
      // Check if deleted_at was set
      const { data: userCheck, error: checkError } = await serviceSupabase
        .from("users")
        .select("deleted_at, email")
        .eq("id", userId)
        .single();

      if (checkError) {
        logger.error("[ProfileService] Error verifying user deletion:", {
          userId,
          error: checkError.message,
        });
        return {
          success: false,
          error: "Failed to verify account deletion",
        };
      }

      if (!userCheck || !userCheck.deleted_at) {
        logger.error("[ProfileService] User anonymization did not set deleted_at:", {
          userId,
          userCheck,
        });
        return {
          success: false,
          error: "Failed to complete account deletion",
        };
      }

      // Verify email was anonymized
      if (userCheck.email && !userCheck.email.startsWith("deleted+")) {
        logger.warn("[ProfileService] Warning: User email may not have been anonymized:", {
          userId,
          email: userCheck.email,
        });
        // Continue - email anonymization may have failed but account is still deleted
      }

      // Clear user verification cache
      const { clearUserVerificationCache } = await import("@/lib/utils/verify-user-exists");
      await clearUserVerificationCache(userId);

      logger.info("[ProfileService] Successfully soft deleted and anonymized user", {
        userId,
        deletedAt: userCheck.deleted_at,
      });

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

