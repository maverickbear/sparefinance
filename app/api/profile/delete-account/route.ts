import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../src/infrastructure/database/supabase-server";
import {
  checkHouseholdOwnership,
  cancelUserSubscription,
  verifyPasswordForDeletion,
  deleteAccountImmediately,
} from "@/lib/api/account-deletion";

/**
 * DELETE /api/profile/delete-account
 * 
 * Deletes user account immediately
 * Flow:
 * 1. Verify authentication
 * 2. Verify password
 * 3. Check household ownership
 * 4. Cancel active subscription
 * 5. Delete account immediately from auth.users
 * 6. Sign out user (will happen automatically when account is deleted)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // 1. Verify password
    const passwordVerification = await verifyPasswordForDeletion(password);
    if (!passwordVerification.valid) {
      return NextResponse.json(
        { error: passwordVerification.error || "Invalid password" },
        { status: 400 }
      );
    }

    // 2. Check household ownership
    const householdCheck = await checkHouseholdOwnership(authUser.id);
    if (householdCheck.isOwner && householdCheck.memberCount > 1) {
      return NextResponse.json(
        {
          error: "Cannot delete account",
          message: `You are the owner of a household "${householdCheck.householdName || "Household"}" with ${householdCheck.memberCount - 1} other member(s). Please transfer ownership to another member or remove all members before deleting your account.`,
          householdId: householdCheck.householdId,
          memberCount: householdCheck.memberCount,
        },
        { status: 400 }
      );
    }

    // 3. Cancel active subscription (don't fail if this fails, but log it)
    const subscriptionResult = await cancelUserSubscription(authUser.id);
    if (!subscriptionResult.cancelled && subscriptionResult.error) {
      console.error("[DELETE-ACCOUNT] Warning: Failed to cancel subscription:", subscriptionResult.error);
      // Continue with deletion anyway
    }

    // 4. Delete account immediately
    const deletionResult = await deleteAccountImmediately(authUser.id);
    if (!deletionResult.success) {
      return NextResponse.json(
        { error: deletionResult.error || "Failed to delete account" },
        { status: 500 }
      );
    }

    // 5. Sign out user (account is already deleted, but sign out to clear any local session)
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      // Ignore sign out errors since account is already deleted
      console.log("[DELETE-ACCOUNT] Sign out after deletion (account already deleted)");
    }

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully. All your data has been permanently removed.",
    });
  } catch (error) {
    console.error("[DELETE-ACCOUNT] Error deleting account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete account" },
      { status: 500 }
    );
  }
}

