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
import { makeSubscriptionsService } from "../subscriptions/subscriptions.factory";
import { makeMembersService } from "../members/members.factory";
import { AppError } from "../shared/app-error";
import { validateImageFile, sanitizeFilename, getFileExtension } from "@/lib/utils/file-validation";
import { SecurityLogger } from "@/src/infrastructure/utils/security-logging";
import {
  checkHouseholdOwnership,
  cancelUserSubscription,
  verifyPasswordForDeletion,
  deleteAccountImmediately,
} from "@/lib/api/account-deletion";

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
      const supabase = await createServerClient(accessToken, refreshToken);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return null;
      }

      const userRow = await this.repository.findById(user.id, accessToken, refreshToken);
      
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
  async updateProfile(data: ProfileFormData): Promise<BaseProfile> {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new AppError("Unauthorized", 401);
    }

    const now = formatTimestamp(new Date());

    // Update user profile
    const userRow = await this.repository.update(user.id, {
      name: data.name || null,
      avatarUrl: data.avatarUrl || null,
      phoneNumber: data.phoneNumber || null,
      updatedAt: now,
    });

    return ProfileMapper.toDomain(userRow);
  }

  /**
   * Update user email (requires re-authentication in Supabase Auth)
   */
  async updateEmail(newEmail: string): Promise<void> {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new AppError("Unauthorized", 401);
    }

    // Update email in Auth (this will send confirmation email)
    await this.repository.updateAuthEmail(user.id, newEmail);

    // Note: Email updates should be handled through auth system, not profile service
    // This method is kept for backward compatibility but email is not updated here
    const now = formatTimestamp(new Date());
    await this.repository.update(user.id, {
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
    // Get user data from repository
    const userRow = await this.repository.findById(userId);
    
    if (!userRow) {
      throw new AppError("User not found", 404);
    }

    // Get subscription and plan data
    const subscriptionsService = makeSubscriptionsService();
    const subscriptionData = await subscriptionsService.getUserSubscriptionData(userId);
    
    // Get user role
    const membersService = makeMembersService();
    const userRole = await membersService.getUserRole(userId);
    
    // Validate and sanitize avatarUrl
    let avatarUrl: string | null = null;
    if (userRow.avatarUrl && typeof userRow.avatarUrl === "string") {
      const trimmed = userRow.avatarUrl.trim();
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
      trialEndDate: subscriptionData.subscription.trialEndDate 
        ? (typeof subscriptionData.subscription.trialEndDate === 'string' 
            ? subscriptionData.subscription.trialEndDate 
            : subscriptionData.subscription.trialEndDate.toISOString())
        : null,
    } : null;

    return {
      user,
      plan,
      subscription,
      userRole,
    };
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
  async deleteAccount(userId: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Verify password
      const passwordVerification = await verifyPasswordForDeletion(password);
      if (!passwordVerification.valid) {
        throw new AppError(passwordVerification.error || "Invalid password", 400);
      }

      // 2. Check household ownership
      const householdCheck = await checkHouseholdOwnership(userId);
      if (householdCheck.isOwner && householdCheck.memberCount > 1) {
        throw new AppError(
          `You are the owner of a household "${householdCheck.householdName || "Household"}" with ${householdCheck.memberCount - 1} other member(s). Please transfer ownership to another member or remove all members before deleting your account.`,
          400
        );
      }

      // 3. Cancel active subscription (don't fail if this fails, but log it)
      const subscriptionResult = await cancelUserSubscription(userId);
      if (!subscriptionResult.cancelled && subscriptionResult.error) {
        logger.error("[ProfileService] Warning: Failed to cancel subscription:", subscriptionResult.error);
      }

      // 4. Delete account immediately
      const deletionResult = await deleteAccountImmediately(userId);
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
}

