import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { getUserSubscriptionData } from "@/lib/api/subscription";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { randomUUID } from "crypto";

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
      console.error("[OAUTH-CALLBACK] No email in OAuth response");
      const redirectUrl = new URL("/auth/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "no_email");
      return NextResponse.redirect(redirectUrl);
    }

    // Sign out to prevent session creation before OTP verification
    await supabase.auth.signOut();

    // Send OTP for login
    const { createClient } = await import("@supabase/supabase-js");
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    console.log("[OAUTH-CALLBACK] Sending OTP for Google login");
    const { error: otpError } = await anonClient.auth.signInWithOtp({
      email: userEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      console.error("[OAUTH-CALLBACK] Error sending OTP:", otpError);
      const redirectUrl = new URL("/auth/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "otp_failed");
      redirectUrl.searchParams.set("error_description", otpError.message || "Failed to send verification code");
      return NextResponse.redirect(redirectUrl);
    }

    // Store OAuth data temporarily in URL params to recreate user profile after OTP verification
    const oauthData = {
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
      avatarUrl: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
      userId: authUser.id,
    };

    // Redirect to OTP verification page with OAuth data
    // Using unified verify-otp route that detects Google OAuth via oauth_data param
    const otpUrl = new URL("/auth/verify-otp", requestUrl.origin);
    otpUrl.searchParams.set("email", userEmail);
    otpUrl.searchParams.set("oauth_data", encodeURIComponent(JSON.stringify(oauthData)));
    
    return NextResponse.redirect(otpUrl);

    // Check if email has a pending invitation
    const { data: pendingInvitation } = await supabase
      .from("HouseholdMember")
      .select("id, householdId, email, Household(createdBy)")
      .eq("email", authUser.email?.toLowerCase() || "")
      .eq("status", "pending")
      .maybeSingle();

    if (pendingInvitation) {
      console.warn("[OAUTH-CALLBACK] User has pending invitation");
      const redirectUrl = new URL("/auth/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "pending_invitation");
      redirectUrl.searchParams.set("error_description", "This email has a pending household invitation. Please accept the invitation from your email or use the invitation link to create your account.");
      return NextResponse.redirect(redirectUrl);
    }

    // Extract user data from OAuth metadata
    const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || null;
    const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;

    // Check if user profile already exists
    const serviceRoleClient = createServiceRoleClient();
    let { data: userData } = await serviceRoleClient
      .from("User")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    const isNewUser = !userData;

    if (!userData) {
      // Create user profile using service role (bypasses RLS)
      const { data: newUserData, error: userError } = await serviceRoleClient
        .from("User")
        .insert({
          id: authUser.id,
          email: authUser.email!,
          name: name,
          avatarUrl: avatarUrl,
          role: "admin", // Owners who sign up directly are admins
        })
        .select()
        .single();

      if (userError) {
        console.error("[OAUTH-CALLBACK] Error creating user profile:", userError);
        
        // If it's a duplicate key error, try to fetch existing user
        const errorCode = userError?.code;
        const errorMessage: string = userError?.message || "";
        const isDuplicateError = errorCode === "23505" || 
          errorMessage.includes("duplicate") || 
          errorMessage.includes("unique");
        
        if (isDuplicateError) {
          const { data: existingUser } = await serviceRoleClient
            .from("User")
            .select("*")
            .eq("id", authUser.id)
            .single();
          
          if (existingUser) {
            userData = existingUser;
          } else {
            throw new Error("Failed to create or fetch user profile");
          }
        } else {
          throw new Error("Failed to create user profile");
        }
      } else {
        userData = newUserData;
        console.log("[OAUTH-CALLBACK] ✅ User profile created");
      }

      // Create personal household automatically for new user
      // This allows users to immediately create accounts, transactions, budgets, and goals
      try {
        const now = formatTimestamp(new Date());
        
        // Check if personal household already exists
        const { data: existingHousehold } = await serviceRoleClient
          .from("Household")
          .select("id")
          .eq("createdBy", authUser.id)
          .eq("type", "personal")
          .maybeSingle();

        if (!existingHousehold) {
          // Create personal household using service role (bypasses RLS)
          const { data: household, error: householdError } = await serviceRoleClient
            .from("Household")
            .insert({
              name: name || "Minha Conta",
              type: "personal",
              createdBy: authUser.id,
              createdAt: now,
              updatedAt: now,
              settings: {},
            })
            .select()
            .single();

          if (householdError || !household) {
            console.error("[OAUTH-CALLBACK] Error creating personal household:", householdError);
          } else {
            // Create HouseholdMember using service role (bypasses RLS)
            const { error: memberError } = await serviceRoleClient
              .from("HouseholdMember")
              .insert({
                householdId: household.id,
                userId: authUser.id,
                role: "owner",
                status: "active",
                isDefault: true,
                joinedAt: now,
                createdAt: now,
                updatedAt: now,
              });

            if (memberError) {
              console.error("[OAUTH-CALLBACK] Error creating household member:", memberError);
            } else {
              // Set as active household using service role (bypasses RLS)
              const { error: activeError } = await serviceRoleClient
                .from("UserActiveHousehold")
                .insert({
                  userId: authUser.id,
                  householdId: household.id,
                  updatedAt: now,
                });

              if (activeError) {
                console.error("[OAUTH-CALLBACK] Error setting active household:", activeError);
              } else {
                console.log("[OAUTH-CALLBACK] ✅ Personal household created for new user");
              }
            }
          }
        }
      } catch (householdError) {
        console.error("[OAUTH-CALLBACK] Error creating household:", householdError);
        // Don't fail OAuth callback if household creation fails - it can be created later
      }
    } else {
      // User already exists - update avatar if available and not set
      if (avatarUrl && !userData.avatarUrl) {
        await serviceRoleClient
          .from("User")
          .update({ avatarUrl: avatarUrl })
          .eq("id", authUser.id);
      }
      
      // Ensure household exists (edge case: user might not have household)
      try {
        const { getActiveHouseholdId } = await import("@/lib/utils/household");
        const householdId = await getActiveHouseholdId(authUser.id);
        if (!householdId) {
          // No household found - create one
          const now = formatTimestamp(new Date());
          const { data: household, error: householdError } = await serviceRoleClient
            .from("Household")
            .insert({
              name: userData.name || "Minha Conta",
              type: "personal",
              createdBy: authUser.id,
              createdAt: now,
              updatedAt: now,
              settings: {},
            })
            .select()
            .single();

          if (!householdError && household) {
            await serviceRoleClient.from("HouseholdMember").insert({
              householdId: household.id,
              userId: authUser.id,
              role: "owner",
              status: "active",
              isDefault: true,
              joinedAt: now,
              createdAt: now,
              updatedAt: now,
            });
            
            await serviceRoleClient.from("UserActiveHousehold").insert({
              userId: authUser.id,
              householdId: household.id,
              updatedAt: now,
            });
            
            console.log("[OAUTH-CALLBACK] ✅ Personal household created for existing user (edge case)");
          }
        }
      } catch (householdError) {
        console.warn("[OAUTH-CALLBACK] Error checking/creating household:", householdError);
        // Don't fail OAuth callback - household check is non-critical
      }
    }

    // Check if there's a pending subscription for this email and link it
    if (userData && authUser.email) {
      try {
        const linkResponse = await fetch(`${requestUrl.origin}/api/stripe/link-subscription`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": request.headers.get("cookie") || "",
          },
          body: JSON.stringify({ email: authUser.email }),
        });

        if (linkResponse.ok) {
          const linkData = await linkResponse.json();
          if (linkData.success) {
            console.log("[OAUTH-CALLBACK] Pending subscription linked automatically");
          }
        }
      } catch (linkError) {
        console.error("[OAUTH-CALLBACK] Error linking pending subscription:", linkError);
        // Don't fail if linking fails
      }
    }

    // Check if user has an active subscription
    try {
      const subscriptionData = await getUserSubscriptionData(authUser.id);
      const subscription = subscriptionData.subscription;
      const hasActiveSubscription = 
        subscription !== null && 
        (subscription?.status === "active" || 
         subscription?.status === "trialing");

      if (!hasActiveSubscription) {
        // No active subscription - redirect to select-plan (which redirects to dashboard with modal)
        return NextResponse.redirect(new URL("/select-plan", requestUrl.origin));
      }

      // User has active subscription - redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
    } catch (subscriptionError) {
      console.error("[OAUTH-CALLBACK] Error checking subscription:", subscriptionError);
      // If we can't check subscription, redirect to select-plan to be safe
      return NextResponse.redirect(new URL("/select-plan", requestUrl.origin));
    }
  } catch (error) {
    console.error("[OAUTH-CALLBACK] Unexpected error:", error);
    const redirectUrl = new URL("/auth/login", requestUrl.origin);
    redirectUrl.searchParams.set("error", "unexpected_error");
    return NextResponse.redirect(redirectUrl);
  }
}

