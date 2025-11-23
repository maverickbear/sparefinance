/**
 * Scheduled job to permanently delete accounts after grace period
 * 
 * This script should be run daily via cron job or scheduled task.
 * It finds all users where scheduledDeletionAt < NOW() and deletes them
 * from auth.users (which cascades to User table).
 * 
 * Usage:
 *   - Run via cron: 0 2 * * * (daily at 2 AM)
 *   - Or call via API endpoint that triggers this script
 */

import { createServiceRoleClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function cleanupDeletedAccounts() {
  console.log("[CLEANUP] Starting account deletion cleanup...");

  try {
    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    // Call the cleanup function to get users scheduled for deletion
    const { data: cleanupResult, error: functionError } = await supabase.rpc(
      "cleanup_deleted_accounts"
    );
    
    type CleanupResult = { deleted_count: number; deleted_user_ids: string[] }[];
    const typedResult = cleanupResult as CleanupResult | null;

    if (functionError) {
      console.error("[CLEANUP] Error calling cleanup function:", functionError);
      throw functionError;
    }

    if (!typedResult || typedResult.length === 0) {
      console.log("[CLEANUP] No accounts scheduled for deletion");
      return { deleted: 0, errors: [] };
    }

    const result = typedResult[0];
    const userIds: string[] = result?.deleted_user_ids || [];
    const count = result?.deleted_count || 0;

    if (count === 0 || userIds.length === 0) {
      console.log("[CLEANUP] No accounts to delete");
      return { deleted: 0, errors: [] };
    }

    console.log(`[CLEANUP] Found ${count} account(s) to delete:`, userIds);

    // Delete users from auth.users using Admin API
    // Note: This requires Supabase Admin API access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        // First, clean up user data (goals, subscriptions) to avoid RESTRICT constraints
        const { error: cleanupError } = await supabase.rpc("delete_user_data", {
          p_user_id: userId,
        });
        
        if (cleanupError) {
          console.warn(`[CLEANUP] Warning: Could not clean up data for user ${userId}:`, cleanupError);
          // Continue with deletion anyway - cascade might handle it
        } else {
          console.log(`[CLEANUP] Cleaned up data for user ${userId}`);
        }
        
        // Delete from auth.users (this will cascade delete from User table)
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

        if (deleteError) {
          console.error(`[CLEANUP] Error deleting user ${userId}:`, deleteError);
          errors.push({ userId, error: deleteError.message });
        } else {
          console.log(`[CLEANUP] Successfully deleted user ${userId}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[CLEANUP] Exception deleting user ${userId}:`, errorMessage);
        errors.push({ userId, error: errorMessage });
      }
    }

    const successCount = count - errors.length;
    console.log(`[CLEANUP] Cleanup complete: ${successCount} deleted, ${errors.length} errors`);

    return {
      deleted: successCount,
      errors,
    };
  } catch (error) {
    console.error("[CLEANUP] Fatal error in cleanup:", error);
    throw error;
  }
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupDeletedAccounts()
    .then((result) => {
      console.log("[CLEANUP] Cleanup completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("[CLEANUP] Cleanup failed:", error);
      process.exit(1);
    });
}

export { cleanupDeletedAccounts };

