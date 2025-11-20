import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase-server";
import { getUserSubscriptionData } from "@/lib/api/subscription";

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
    const supabase = await createServerClient();

    // Exchange the code for a session
    // The createServerClient with @supabase/ssr will automatically handle cookie setting
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data.session || !data.user) {
      console.error("[OAUTH-CALLBACK] Error exchanging code for session:", exchangeError);
      const redirectUrl = new URL("/auth/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "exchange_failed");
      if (exchangeError?.message) {
        redirectUrl.searchParams.set("error_description", exchangeError.message);
      }
      return NextResponse.redirect(redirectUrl);
    }

    const authUser = data.user;

    // Check if email has a pending invitation
    const { data: pendingInvitation } = await supabase
      .from("HouseholdMemberNew")
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
        if (userError.code === "23505" || 
            userError.message?.includes("duplicate") || 
            userError.message?.includes("unique")) {
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

      // Create personal household and member record for the owner
      if (userData) {
        const now = new Date().toISOString();
        
        // Create personal household
        const { data: household, error: householdError } = await serviceRoleClient
          .from("Household")
          .insert({
            name: name || authUser.email || "Minha Conta",
            type: "personal",
            createdBy: userData.id,
            createdAt: now,
            updatedAt: now,
            settings: {},
          })
          .select()
          .single();

        if (householdError || !household) {
          console.error("[OAUTH-CALLBACK] Error creating household:", householdError);
        } else {
          // Create household member (owner role)
          const { error: householdMemberError } = await serviceRoleClient
            .from("HouseholdMemberNew")
            .insert({
              householdId: household.id,
              userId: userData.id,
              role: "owner",
            status: "active",
              isDefault: true,
              joinedAt: now,
            createdAt: now,
            updatedAt: now,
          });

          if (householdMemberError) {
            console.error("[OAUTH-CALLBACK] Error creating household member:", householdMemberError);
          } else {
            // Set as active household
            await serviceRoleClient
              .from("UserActiveHousehold")
              .insert({
                userId: userData.id,
                householdId: household.id,
                updatedAt: now,
              });
          }
        }

        if (householdMemberError) {
          // If it's a duplicate, that's OK
          if (householdMemberError.code !== "23505" && 
              !householdMemberError.message?.includes("duplicate") && 
              !householdMemberError.message?.includes("unique")) {
            console.error("[OAUTH-CALLBACK] Error creating household member:", householdMemberError);
          }
        } else {
          console.log("[OAUTH-CALLBACK] ✅ Household member created");
        }
      }
    } else {
      // User already exists - update avatar if available and not set
      if (avatarUrl && !userData.avatarUrl) {
        await serviceRoleClient
          .from("User")
          .update({ avatarUrl: avatarUrl })
          .eq("id", authUser.id);
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
      const hasActiveSubscription = 
        subscriptionData.subscription && 
        (subscriptionData.subscription.status === "active" || 
         subscriptionData.subscription.status === "trialing");

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

