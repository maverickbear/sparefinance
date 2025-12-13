import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

/**
 * GET /auth/callback
 * Handles OAuth callback from Google
 * Processes the authorization code, exchanges it for a session, creates user profile if needed,
 * and redirects to appropriate page based on subscription status
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const flow = requestUrl.searchParams.get("flow") as "signin" | "signup" | null; // Get flow from URL params

  // Handle OAuth errors (user cancelled, etc.)
  if (error) {
    console.error("[OAUTH-CALLBACK] OAuth error:", error, errorDescription);
    const redirectUrl = new URL("/auth/login", requestUrl.origin);
    redirectUrl.searchParams.set("error", error === "access_denied" ? "oauth_cancelled" : "oauth_error");
    if (errorDescription) {
      redirectUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // If no code, redirect to login
  if (!code) {
    console.warn("[OAUTH-CALLBACK] No authorization code received");
    const redirectUrl = new URL("/auth/login", requestUrl.origin);
    redirectUrl.searchParams.set("error", "no_code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    console.log("[OAUTH-CALLBACK] Processing OAuth callback", {
      hasCode: !!code,
      hasError: !!error,
    });

    // Create server client with proper cookie handling for PKCE
    // The code verifier should be in cookies if using @supabase/ssr correctly
    // The createServerClient function reads cookies automatically via @supabase/ssr
    const supabase = await createServerClient();

    // Debug: Check if code verifier cookie exists (for troubleshooting)
    // The cookie name format is: sb-{project-ref}-auth-code-verifier
    const cookieStore = await import("next/headers").then(m => m.cookies());
    const allCookies = cookieStore.getAll();
    const hasCodeVerifierCookie = allCookies.some(cookie => 
      cookie.name.includes("auth-code-verifier") || 
      cookie.name.includes("code-verifier")
    );
    
    if (!hasCodeVerifierCookie) {
      console.warn("[OAUTH-CALLBACK] Code verifier cookie not found in request cookies");
      console.log("[OAUTH-CALLBACK] Available cookies:", allCookies.map(c => c.name).join(", "));
    }

    // Exchange the code for a session temporarily to get user info
    // We'll sign out and require OTP verification before final login
    // Note: exchangeCodeForSession requires the code verifier from cookies for PKCE flow
    // The @supabase/ssr package should automatically read the code verifier from cookies
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data.session || !data.user) {
      console.error("[OAUTH-CALLBACK] Error exchanging code for session:", {
        error: exchangeError?.message,
        code: exchangeError?.code,
        status: exchangeError?.status,
        // Log if it's a PKCE error
        isPkceError: exchangeError?.message?.includes("code verifier") || exchangeError?.message?.includes("pkce"),
      });
      
      // If it's a PKCE error, the code verifier might not be in cookies
      // This can happen if the OAuth flow was initiated from a different domain or session
      const isPkceError = exchangeError?.message?.includes("code verifier") || 
                         exchangeError?.message?.includes("pkce") ||
                         exchangeError?.message?.includes("non-empty");
      
      const redirectUrl = new URL("/auth/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "exchange_failed");
      
      if (isPkceError) {
        redirectUrl.searchParams.set("error_description", "Authentication session expired. Please try signing in again.");
      } else if (exchangeError?.message) {
        redirectUrl.searchParams.set("error_description", exchangeError.message);
      }
      
      return NextResponse.redirect(redirectUrl);
    }

    const authUser = data.user;
    const userEmail = authUser.email;

    if (!userEmail) {
      console.error("[OAUTH-CALLBACK] No email in OAuth response", {
        userId: authUser.id,
        hasMetadata: !!authUser.user_metadata,
      });
      // Sign out the temporary session before redirecting
      await supabase.auth.signOut();
      
      const redirectUrl = new URL("/auth/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "no_email");
      redirectUrl.searchParams.set("error_description", "No email address found in Google account. Please use a different authentication method.");
      return NextResponse.redirect(redirectUrl);
    }

    console.log(`[OAUTH-CALLBACK] OAuth user authenticated`, {
      userId: authUser.id,
      email: userEmail,
      emailConfirmed: !!authUser.email_confirmed_at,
      flow: flow || "unknown",
    });

    // Determine if this is signup or signin
    // Priority: 1. Flow parameter from URL, 2. Check if user exists in User table
    let isSignup: boolean;
    
    if (flow === "signup") {
      isSignup = true;
      console.log(`[OAUTH-CALLBACK] Flow explicitly set to SIGNUP`);
    } else if (flow === "signin") {
      isSignup = false;
      console.log(`[OAUTH-CALLBACK] Flow explicitly set to SIGNIN`);
    } else {
      // Fallback: Check if user exists in User table
      const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
      const serviceRoleClient = createServiceRoleClient();
      
      const { data: existingUser, error: userCheckError } = await serviceRoleClient
        .from("users")
        .select("id")
        .eq("id", authUser.id)
        .maybeSingle();
      
      isSignup = !existingUser || !!userCheckError;
      console.log(`[OAUTH-CALLBACK] Flow not specified, detected ${isSignup ? 'SIGNUP' : 'SIGNIN'} by checking User table`);
    }
    
    console.log(`[OAUTH-CALLBACK] Processing ${isSignup ? 'SIGNUP' : 'SIGNIN'} for user ${authUser.id}`);

    // For signup, check for pending invitation (same validation as form signup)
    if (isSignup) {
      const { AuthRepository } = await import("@/src/infrastructure/database/repositories/auth.repository");
      const authRepository = new AuthRepository();
      
      const pendingInvitation = await authRepository.findPendingInvitation(userEmail);
      if (pendingInvitation) {
        console.warn(`[OAUTH-CALLBACK] User ${userEmail} has pending invitation - blocking signup`, {
          invitationId: pendingInvitation.id,
          householdId: pendingInvitation.householdId,
        });
        // Sign out the temporary session before redirecting
        await supabase.auth.signOut();
        
        const redirectUrl = new URL("/auth/login", requestUrl.origin);
        redirectUrl.searchParams.set("error", "pending_invitation");
        redirectUrl.searchParams.set("error_description", "This email has a pending household invitation. Please accept the invitation from your email or use the invitation link to create your account.");
        return NextResponse.redirect(redirectUrl);
      }
      console.log(`[OAUTH-CALLBACK] No pending invitation found for ${userEmail} - proceeding with signup`);
    }

    // Check if email is already confirmed by Google
    // If confirmed and it's a signup, we can skip OTP and proceed directly to profile creation
    // For signin, we still require OTP for security (even if email is confirmed)
    const emailConfirmed = !!authUser.email_confirmed_at;
    
    if (emailConfirmed && isSignup) {
      // Email is confirmed and this is a signup - create profile and redirect to dashboard
      console.log("[OAUTH-CALLBACK] Email already confirmed by Google for signup, creating profile directly");
      
      // Create user profile and household
      try {
        const { makeAuthService } = await import("@/src/application/auth/auth.factory");
        const authService = makeAuthService();
        
        const profileResult = await authService.createUserProfile({
          userId: authUser.id,
          email: userEmail,
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
          avatarUrl: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
        });
        
        if (!profileResult.success) {
          console.error("[OAUTH-CALLBACK] Failed to create user profile:", profileResult.message);
          // Continue anyway - profile might already exist
        } else {
          console.log("[OAUTH-CALLBACK] ✅ User profile created successfully");
        }
      } catch (profileError) {
        console.error("[OAUTH-CALLBACK] Error creating user profile:", profileError);
        // Continue anyway - profile might already exist
      }
      
      // Sync session with server
      try {
        await fetch(`${requestUrl.origin}/api/auth/sync-session`, {
          method: "POST",
          credentials: "include",
        });
      } catch (syncError) {
        console.warn("[OAUTH-CALLBACK] Failed to sync session:", syncError);
      }
      
      // Redirect to dashboard
      const dashboardUrl = new URL("/dashboard", requestUrl.origin);
      return NextResponse.redirect(dashboardUrl);
    }
    
    // For signin or unconfirmed signup, require OTP verification
    
    // For signin or unconfirmed signup, require OTP verification
    // Sign out to prevent session creation before OTP verification
    await supabase.auth.signOut();

    // Send OTP - Use signInWithOtp for both signup and signin
    // This is the most reliable method for OAuth users
    console.log(`[OAUTH-CALLBACK] Sending OTP for Google ${isSignup ? 'signup' : 'login'}`);
    
    // Use anon client for OTP sending
    const { createClient } = await import("@supabase/supabase-js");
    // New format (sb_publishable_...) is preferred, fallback to old format (anon JWT) for backward compatibility
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseAnonKey) {
      console.error("[OAUTH-CALLBACK] Missing Supabase API key");
      return NextResponse.redirect(new URL("/auth/login?error=server_error", request.url));
    }
    
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    
    // Send OTP using signInWithOtp
    // For OAuth users, this is the most reliable way to send an email
    const { error: otpError } = await anonClient.auth.signInWithOtp({
      email: userEmail,
      options: {
        shouldCreateUser: false, // User already exists from OAuth
      },
    });

    if (otpError) {
      console.error("[OAUTH-CALLBACK] Error sending OTP:", {
        error: otpError.message,
        code: otpError.status,
        email: userEmail,
        isSignup,
      });
      
      // Check for rate limiting errors
      const isRateLimitError = otpError.message?.toLowerCase().includes("rate limit") || 
                               otpError.message?.toLowerCase().includes("too many requests");
      if (isRateLimitError) {
        const redirectUrl = new URL("/auth/login", requestUrl.origin);
        redirectUrl.searchParams.set("error", "rate_limit");
        redirectUrl.searchParams.set("error_description", "Too many verification requests. Please wait a few minutes and try again.");
        return NextResponse.redirect(redirectUrl);
      }
      
      const redirectUrl = new URL("/auth/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "otp_failed");
      redirectUrl.searchParams.set("error_description", otpError.message || "Failed to send verification code. Please try again.");
      return NextResponse.redirect(redirectUrl);
    }
    
    console.log(`[OAUTH-CALLBACK] ✅ OTP email sent successfully to ${userEmail}`);

    // Store OAuth data temporarily in URL params to recreate user profile after OTP verification
    const oauthData = {
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
      avatarUrl: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
      userId: authUser.id,
    };

    console.log(`[OAUTH-CALLBACK] OTP sent successfully to ${userEmail}. Redirecting to OTP verification.`);

    // Redirect to OTP verification page with OAuth data
    // Using unified verify-otp route that detects Google OAuth via oauth_data param
    const otpUrl = new URL("/auth/verify-otp", requestUrl.origin);
    otpUrl.searchParams.set("email", userEmail);
    otpUrl.searchParams.set("oauth_data", encodeURIComponent(JSON.stringify(oauthData)));
    // Pass isSignup flag so the component knows which OTP type to use
    if (isSignup) {
      otpUrl.searchParams.set("is_signup", "true");
    }
    
    return NextResponse.redirect(otpUrl);
  } catch (error) {
    console.error("[OAUTH-CALLBACK] Unexpected error:", error);
    const redirectUrl = new URL("/auth/login", requestUrl.origin);
    redirectUrl.searchParams.set("error", "unexpected_error");
    return NextResponse.redirect(redirectUrl);
  }
}

