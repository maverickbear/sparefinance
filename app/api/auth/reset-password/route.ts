import { NextRequest, NextResponse } from "next/server";
import { resetPassword } from "@/lib/api/auth";
import { resetPasswordSchema } from "@/lib/validations/auth";

/**
 * POST /api/auth/reset-password
 * Updates user password after password reset
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, confirmPassword } = body;

    console.log("[RESET-PASSWORD] Request received");

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { error: "Password and confirmation are required" },
        { status: 400 }
      );
    }

    // Validate schema
    const validationResult = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    // Reset password (includes HIBP validation)
    const result = await resetPassword({ password, confirmPassword });

    if (result.error) {
      console.error("[RESET-PASSWORD] Error resetting password:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log("[RESET-PASSWORD] Password reset successfully");
    return NextResponse.json({ 
      success: true,
      message: "Password reset successfully" 
    });
  } catch (error) {
    console.error("[RESET-PASSWORD] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

