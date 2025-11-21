import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/resend-login-otp
 * Resends OTP email for login verification
 * This endpoint doesn't require password validation since credentials were already validated
 * Rate limiting should be handled at the infrastructure level
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    console.log("[RESEND-LOGIN-OTP] Request received for email:", email);

    if (!email) {
      console.error("[RESEND-LOGIN-OTP] Email is missing");
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Use anon client to send OTP
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    console.log("[RESEND-LOGIN-OTP] Resending OTP for login");
    const { error: otpError } = await anonClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Don't create user if doesn't exist
      },
    });

    if (otpError) {
      console.error("[RESEND-LOGIN-OTP] Error resending OTP:", {
        message: otpError.message,
        status: otpError.status,
        name: otpError.name,
      });
      
      // Provide more helpful error messages
      let errorMessage = "Failed to resend verification code";
      if (otpError.message?.includes("rate limit") || otpError.message?.includes("too many")) {
        errorMessage = "Too many attempts. Please wait a few minutes before trying again.";
      } else if (otpError.message?.includes("not found") || otpError.message?.includes("user")) {
        errorMessage = "User not found. Please verify that the email is correct.";
      } else {
        errorMessage = otpError.message || errorMessage;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    console.log("[RESEND-LOGIN-OTP] OTP resent successfully to:", email);
    return NextResponse.json({ 
      success: true,
      message: "Verification code resent successfully" 
    });
  } catch (error) {
    console.error("[RESEND-LOGIN-OTP] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

