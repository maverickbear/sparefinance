import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { createServerClient } from "@/lib/supabase-server";

/**
 * POST /api/auth/login-trusted
 * 
 * Signs in a user directly without OTP when browser is trusted.
 * This route validates credentials and creates a session.
 * 
 * Security: This should only be called when the browser is verified as trusted
 * by the client-side trusted browser check.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log("[LOGIN-TRUSTED] Request received for email:", email);

    if (!email) {
      console.error("[LOGIN-TRUSTED] Email is missing");
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!password) {
      console.error("[LOGIN-TRUSTED] Password is missing");
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Use service role client to validate credentials
    const serviceRoleClient = createServiceRoleClient();

    // Validate credentials by attempting to sign in
    const { data: authData, error: authError } = await serviceRoleClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.error("[LOGIN-TRUSTED] Invalid credentials:", authError?.message);
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
      .from("User")
      .select("isBlocked, role")
      .eq("id", authData.user.id)
      .single();

    if (!userError && userData?.isBlocked && userData?.role !== "super_admin") {
      console.log("[LOGIN-TRUSTED] User is blocked:", authData.user.id);
      return NextResponse.json(
        { error: "Your account has been blocked. Please contact support@sparefinance.com for assistance." },
        { status: 403 }
      );
    }

    // Create a session using the server client
    // Sign in with password using server client to create a proper session with cookies
    const serverClient = await createServerClient();
    
    const { data: sessionData, error: sessionError } = await serverClient.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      console.error("[LOGIN-TRUSTED] Error creating session:", sessionError?.message);
      return NextResponse.json(
        { error: "Failed to create session. Please try again." },
        { status: 500 }
      );
    }

    console.log("[LOGIN-TRUSTED] Login successful for trusted browser:", email);
    
    // Create response with success
    const response = NextResponse.json({ 
      success: true,
      user: {
        id: sessionData.user.id,
        email: sessionData.user.email,
      },
    });

    // Set session cookies explicitly to ensure they're set correctly
    const expiresIn = sessionData.session.expires_in || 3600;
    const maxAge = expiresIn;
    const refreshMaxAge = 7 * 24 * 60 * 60; // 7 days for refresh token

    response.cookies.set("sb-access-token", sessionData.session.access_token, {
      path: "/",
      maxAge: maxAge,
      httpOnly: false, // Allow client-side access for Supabase client
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    response.cookies.set("sb-refresh-token", sessionData.session.refresh_token, {
      path: "/",
      maxAge: refreshMaxAge,
      httpOnly: false, // Allow client-side access for Supabase client
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("[LOGIN-TRUSTED] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

