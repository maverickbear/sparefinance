import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/api/auth";

/**
 * POST /api/auth/forgot-password
 * Sends password reset email to user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    console.log("[FORGOT-PASSWORD] Request received for email:", email);

    if (!email) {
      console.error("[FORGOT-PASSWORD] Email is missing");
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Request password reset
    // Note: This always returns success to prevent email enumeration
    const result = await requestPasswordReset({ email });

    // Always return success message to prevent email enumeration
    // Even if the email doesn't exist, we don't reveal that information
    console.log("[FORGOT-PASSWORD] Password reset email sent (or would be sent) to:", email);
    return NextResponse.json({ 
      success: true,
      message: "If an account exists with this email, you will receive a password reset link shortly." 
    });
  } catch (error) {
    console.error("[FORGOT-PASSWORD] Unexpected error:", error);
    // Still return success to prevent email enumeration
    return NextResponse.json({ 
      success: true,
      message: "If an account exists with this email, you will receive a password reset link shortly." 
    });
  }
}

