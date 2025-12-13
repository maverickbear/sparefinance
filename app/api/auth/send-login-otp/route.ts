import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { verifyTurnstileToken, getClientIp } from "@/src/infrastructure/utils/turnstile";

/**
 * POST /api/auth/send-login-otp
 * Sends OTP email to user for login verification
 * First validates credentials, then sends OTP
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, turnstileToken } = body;

    console.log("[SEND-LOGIN-OTP] Request received for email:", email);

    if (!email) {
      console.error("[SEND-LOGIN-OTP] Email is missing");
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!password) {
      console.error("[SEND-LOGIN-OTP] Password is missing");
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Validate Turnstile token
    const clientIp = getClientIp(request);
    const turnstileValidation = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!turnstileValidation.success) {
      return NextResponse.json(
        { error: turnstileValidation.error || "Security verification failed" },
        { status: 400 }
      );
    }

    // Use service role client to validate credentials without creating a user session
    const serviceRoleClient = createServiceRoleClient();

    // First, validate credentials by attempting to sign in with service role
    // This won't create a session in the user's browser
    const { data: authData, error: authError } = await serviceRoleClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.error("[SEND-LOGIN-OTP] Invalid credentials:", authError?.message);
      // Don't reveal if email exists or not for security
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if email is confirmed
    if (!authData.user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please confirm your email before signing in. Check your inbox for the confirmation link." },
        { status: 401 }
      );
    }

    // Check if user is blocked
    const { data: userData, error: userError } = await serviceRoleClient
      .from("users")
      .select("is_blocked, role")
      .eq("id", authData.user.id)
      .single();

    if (!userError && userData?.is_blocked && userData?.role !== "super_admin") {
      console.log("[SEND-LOGIN-OTP] User is blocked:", authData.user.id);
      return NextResponse.json(
        { error: "Your account has been blocked. Please contact support@sparefinance.com for assistance." },
        { status: 403 }
      );
    }

    // Send OTP for login (numeric OTP sent via email)
    // Use anon client to send OTP (service role might not work correctly for OTP)
    // New format (sb_publishable_...) is preferred, fallback to old format (anon JWT) for backward compatibility
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseAnonKey) {
      console.error("[SEND-LOGIN-OTP] Missing Supabase API key");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    console.log("[SEND-LOGIN-OTP] Sending OTP for login");
    
    // Prepare OTP options
    const otpOptions: any = {
      shouldCreateUser: false, // Don't create user if doesn't exist
    };
    
    const { error: otpError } = await anonClient.auth.signInWithOtp({
      email,
      options: otpOptions,
    });

    if (otpError) {
      console.error("[SEND-LOGIN-OTP] Error sending OTP:", {
        message: otpError.message,
        status: otpError.status,
        name: otpError.name,
      });
      
      // Provide more helpful error messages
      let errorMessage = "Failed to send verification code";
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

    console.log("[SEND-LOGIN-OTP] OTP sent successfully to:", email);
    return NextResponse.json({ 
      success: true,
      message: "Verification code sent successfully" 
    });
  } catch (error) {
    console.error("[SEND-LOGIN-OTP] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

