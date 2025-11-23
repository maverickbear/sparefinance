import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/admin/cleanup-deleted-accounts
 * 
 * Scheduled job endpoint to permanently delete accounts after grace period
 * Should be called by a cron job or scheduled task daily.
 * 
 * Security: Should be protected by API key or internal network only
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add API key authentication here
    const authHeader = request.headers.get("authorization");
    const expectedApiKey = process.env.CLEANUP_API_KEY;
    
    if (expectedApiKey && authHeader !== `Bearer ${expectedApiKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[CLEANUP] Starting account deletion cleanup...");

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
      return NextResponse.json(
        { error: "Failed to get accounts for cleanup", details: functionError.message },
        { status: 500 }
      );
    }

    if (!typedResult || typedResult.length === 0) {
      console.log("[CLEANUP] No accounts scheduled for deletion");
      return NextResponse.json({ deleted: 0, errors: [] });
    }

    const result = typedResult[0];
    const userIds: string[] = result?.deleted_user_ids || [];
    const count = result?.deleted_count || 0;

    if (count === 0 || userIds.length === 0) {
      console.log("[CLEANUP] No accounts to delete");
      return NextResponse.json({ deleted: 0, errors: [] });
    }

    console.log(`[CLEANUP] Found ${count} account(s) to delete:`, userIds);

    // Delete users from auth.users using Admin API
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

    return NextResponse.json({
      success: true,
      deleted: successCount,
      total: count,
      errors,
    });
  } catch (error) {
    console.error("[CLEANUP] Fatal error in cleanup:", error);
    return NextResponse.json(
      { error: "Failed to cleanup deleted accounts", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

