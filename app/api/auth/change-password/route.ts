import { NextRequest, NextResponse } from "next/server";
import { changePassword } from "@/lib/api/auth";
import { changePasswordSchema } from "@/lib/validations/auth";

/**
 * POST /api/auth/change-password
 * Changes user password after verifying current password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    console.log("[CHANGE-PASSWORD] Request received");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "All password fields are required" },
        { status: 400 }
      );
    }

    // Validate schema
    const validationResult = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    // Change password (includes current password verification and HIBP validation)
    const result = await changePassword({ currentPassword, newPassword, confirmPassword });

    if (result.error) {
      console.error("[CHANGE-PASSWORD] Error changing password:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log("[CHANGE-PASSWORD] Password changed successfully");
    return NextResponse.json({ 
      success: true,
      message: "Password changed successfully" 
    });
  } catch (error) {
    console.error("[CHANGE-PASSWORD] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

