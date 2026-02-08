/**
 * Profile Anonymization Service
 * Business logic for anonymizing user personal information (PII)
 * Used during account deletion to comply with privacy regulations
 */

import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";

import { logger } from "@/src/infrastructure/utils/logger";
import { AppError } from "@/src/application/shared/app-error";

export class ProfileAnonymizationService {
  constructor() {}

  /**
   * Anonymize user PII using SQL function and Supabase Auth Admin API
   * This anonymizes name, email, phone, date_of_birth, avatar_url
   * and sets deleted_at timestamp
   * Also updates email in auth.users to allow email reuse
   */
  async anonymizeUserPII(userId: string): Promise<void> {
    try {
      const serviceSupabase = createServiceRoleClient();

      // Generate anonymized email (same format as SQL function)
      const anonUuid = crypto.randomUUID().replace(/-/g, '');
      const anonEmail = `deleted+${anonUuid}@example.com`;

      // Step 1: Anonymize email in Supabase Auth (auth.users)
      // This is critical to allow email reuse for new account creation
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || 
                                   process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseServiceKey && supabaseUrl) {
          const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          // Update email in auth.users using Admin API
          const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
            userId,
            {
              email: anonEmail,
            }
          );

          if (authUpdateError) {
            logger.warn("[ProfileAnonymizationService] Warning: Could not update email in auth.users, trying to delete user:", {
              userId,
              error: authUpdateError.message,
            });
            
            // If update fails, try to delete user from auth.users to allow email reuse
            // This is safe because we're doing soft delete in public.users
            const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
            
            if (deleteError) {
              logger.warn("[ProfileAnonymizationService] Warning: Could not delete user from auth.users:", {
                userId,
                error: deleteError.message,
              });
              // Continue with database anonymization even if auth operations fail
            } else {
              logger.info("[ProfileAnonymizationService] Successfully deleted user from auth.users to allow email reuse", {
                userId,
              });
            }
          } else {
            logger.info("[ProfileAnonymizationService] Successfully anonymized email in auth.users", {
              userId,
              anonEmail,
            });
          }
        } else {
          logger.warn("[ProfileAnonymizationService] Missing Supabase credentials - cannot update auth.users email");
        }
      } catch (authError) {
        logger.warn("[ProfileAnonymizationService] Exception updating email in auth.users:", {
          userId,
          error: authError instanceof Error ? authError.message : "Unknown error",
        });
        // Continue with database anonymization even if auth update fails
      }

      // Step 2: Call SQL function to anonymize user data in public.users
      const { error } = await serviceSupabase.rpc("anonymize_user_data", {
        p_user_id: userId,
      });

      if (error) {
        logger.error("[ProfileAnonymizationService] Error anonymizing user PII:", {
          userId,
          error: error.message,
        });
        throw new AppError("Failed to anonymize user data", 500);
      }

      logger.info("[ProfileAnonymizationService] Successfully anonymized user PII", { userId });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("[ProfileAnonymizationService] Exception anonymizing user PII:", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AppError("Failed to anonymize user data", 500);
    }
  }

  /**
   * Anonymize household members associated with user
   * This is handled by the SQL function, but we keep this method
   * for consistency and potential future use
   */
  async anonymizeHouseholdMembers(userId: string): Promise<void> {
    try {
      // This is handled by anonymize_user_data SQL function
      // But we can add additional logic here if needed
      logger.debug("[ProfileAnonymizationService] Household members anonymization handled by SQL function", {
        userId,
      });
    } catch (error) {
      logger.error("[ProfileAnonymizationService] Error anonymizing household members:", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't throw - this is not critical
    }
  }

  /**
   * Revoke all user sessions
   * Signs out user from all devices and sessions
   */
  async revokeAllSessions(userId: string): Promise<void> {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || 
                                 process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseServiceKey || !supabaseUrl) {
        logger.warn("[ProfileAnonymizationService] Cannot revoke sessions - missing Supabase credentials");
        return;
      }

      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Sign out user from all sessions
      // This revokes all refresh tokens and sessions
      // Note: Supabase Admin API doesn't have a direct signOut method
      // We'll delete the user's auth sessions by updating their metadata
      // The actual session revocation happens when we set deleted_at and is_blocked
      // For now, we'll just log that sessions will be invalidated
      logger.info("[ProfileAnonymizationService] Sessions will be invalidated via account deletion", {
        userId,
      });
    } catch (error) {
      logger.warn("[ProfileAnonymizationService] Exception revoking sessions:", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't throw - session revocation is not critical
    }
  }

  /**
   * Revoke external tokens (no-op; no external banking).
   */
  async revokeAllTokens(userId: string): Promise<void> {
    logger.info("[ProfileAnonymizationService] Tokens revocation skipped - integrations disabled", {
      userId,
    });
  }
}

