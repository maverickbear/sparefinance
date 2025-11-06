import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { signInSchema } from "@/lib/validations/auth";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate data
    const validatedData = signInSchema.parse(body);
    
    // Create Supabase client with cookie management
    const supabase = await createServerClient();
    
    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (authError) {
      // Get user-friendly error message (handles HIBP and other auth errors automatically)
      const errorMessage = getAuthErrorMessage(authError, "Failed to sign in");
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to sign in. Please try again." },
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

    // Get or create user profile
    let { data: userData } = await supabase
      .from("User")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (!userData) {
      // Create user profile if it doesn't exist (owners who sign in directly are admins)
      const { data: newUser, error: userError } = await supabase
        .from("User")
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata?.name || null,
          role: "admin", // Owners who sign in directly are admins
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error("Error creating user profile:", userError);
        return NextResponse.json(
          { error: "Failed to create user profile" },
          { status: 500 }
        );
      }

      userData = newUser;
    }

    // Ensure every user has a free subscription
    console.log("[SIGNIN] Ensuring user has free subscription:", userData.id);
    
    // Check if user already has a subscription
    const { data: existingSubscription } = await supabase
      .from("Subscription")
      .select("id, planId, status")
      .eq("userId", userData.id)
      .eq("status", "active")
      .single();

    if (!existingSubscription) {
      console.log("[SIGNIN] No active subscription found, creating free subscription");
      
      // Ensure free plan exists before creating subscription
      const { data: existingPlan } = await supabase
        .from("Plan")
        .select("id")
        .eq("id", "free")
        .single();

      if (!existingPlan) {
        console.log("[SIGNIN] Free plan not found, creating it");
        // Create free plan if it doesn't exist
        await supabase
          .from("Plan")
          .insert({
            id: "free",
            name: "free",
            priceMonthly: 0.00,
            priceYearly: 0.00,
            features: {
              maxTransactions: 50,
              maxAccounts: 2,
              hasInvestments: false,
              hasAdvancedReports: false,
              hasCsvExport: false,
              hasDebts: true,
              hasGoals: true,
            },
          });
        console.log("[SIGNIN] Free plan created successfully");
      }

      // Create free subscription for new user
      const { data: newSubscription, error: subscriptionError } = await supabase
        .from("Subscription")
        .insert({
          id: crypto.randomUUID(),
          userId: userData.id,
          planId: "free",
          status: "active",
        })
        .select()
        .single();

      if (subscriptionError) {
        console.error("[SIGNIN] Error creating subscription:", subscriptionError);
        // Don't fail the signin if subscription creation fails
      } else {
        console.log("[SIGNIN] Free subscription created successfully:", { 
          subscriptionId: newSubscription.id, 
          userId: userData.id,
          planId: "free"
        });
      }
    } else {
      console.log("[SIGNIN] User already has active subscription:", {
        subscriptionId: existingSubscription.id,
        planId: existingSubscription.planId,
        status: existingSubscription.status
      });
    }

    // Get session - it should be available in authData after signInWithPassword
    // The session is returned directly from signInWithPassword
    let activeSession = authData.session;
    
    // If session is not in authData, try to get it explicitly
    if (!activeSession) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        activeSession = session;
      }
    }

    // Create response with user data
    const response = NextResponse.json({ 
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name || undefined,
        avatarUrl: userData.avatarUrl || undefined,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
      }
    });

    // Set auth cookies if session exists
    if (activeSession) {
      // Set access token cookie
      if (activeSession.access_token) {
        response.cookies.set("sb-access-token", activeSession.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
      }

      // Set refresh token cookie
      if (activeSession.refresh_token) {
        response.cookies.set("sb-refresh-token", activeSession.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }
    } else {
      console.error("No session found after sign in");
    }

    return response;
  } catch (error) {
    console.error("Error in sign in:", error);
    
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to sign in" },
      { status: 500 }
    );
  }
}

