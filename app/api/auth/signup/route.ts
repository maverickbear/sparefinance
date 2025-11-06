import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { signUpSchema } from "@/lib/validations/auth";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";

export async function POST(request: NextRequest) {
  try {
    console.log("[SIGNUP] Starting signup process");
    const body = await request.json();
    console.log("[SIGNUP] Request body received:", { email: body.email, hasName: !!body.name });
    
    // Validate data
    const validatedData = signUpSchema.parse(body);
    console.log("[SIGNUP] Data validated successfully");
    
    // Check password against HIBP before attempting signup
    console.log("[SIGNUP] Checking password against HIBP");
    const passwordValidation = await validatePasswordAgainstHIBP(validatedData.password);
    if (!passwordValidation.isValid) {
      console.log("[SIGNUP] Password failed HIBP check:", passwordValidation.error);
      return NextResponse.json(
        { error: passwordValidation.error || "Invalid password" },
        { status: 400 }
      );
    }
    console.log("[SIGNUP] Password passed HIBP check");
    
    // Create Supabase client with cookie management
    const supabase = await createServerClient();
    console.log("[SIGNUP] Supabase client created");
    
    // Sign up user with Supabase Auth (disable email confirmation)
    console.log("[SIGNUP] Attempting to sign up user with Supabase");
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        emailRedirectTo: undefined, // Don't require email confirmation
        data: {
          name: validatedData.name || "",
        },
      },
    });

    if (authError) {
      console.error("[SIGNUP] Auth error during signup:", authError);
      
      // Get user-friendly error message (handles HIBP errors automatically)
      const errorMessage = getAuthErrorMessage(authError, "Failed to sign up");
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    if (!authData.user) {
      console.error("[SIGNUP] No user returned from signup");
      return NextResponse.json(
        { error: "Failed to create account. Please try again." },
        { status: 400 }
      );
    }

    console.log("[SIGNUP] User created successfully:", { userId: authData.user.id, email: authData.user.email });

    // Use session from signup if available (when email confirmation is disabled)
    // Otherwise, sign in to create a session
    let activeSession = authData.session;
    let authenticatedUser = authData.user;

    console.log("[SIGNUP] Session from signup:", { hasSession: !!activeSession, hasAccessToken: !!activeSession?.access_token });

    if (!activeSession) {
      console.log("[SIGNUP] No session from signup, attempting to sign in to create session");
      // If no session from signup, automatically sign in to create a session
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (signInError || !signInData.user) {
        console.error("[SIGNUP] Error during automatic signin:", signInError);
        // If sign in fails, the user was created but we can't authenticate
        // This shouldn't happen, but handle it gracefully
        return NextResponse.json(
          { error: "Account created but failed to authenticate. Please try signing in." },
          { status: 400 }
        );
      }

      console.log("[SIGNUP] Automatic signin successful:", { userId: signInData.user.id });
      authenticatedUser = signInData.user;
      activeSession = signInData.session;
      console.log("[SIGNUP] Session from signin:", { hasSession: !!activeSession, hasAccessToken: !!activeSession?.access_token });
    }

    // Get or create user profile
    console.log("[SIGNUP] Checking for existing user profile:", authenticatedUser.id);
    let { data: userData } = await supabase
      .from("User")
      .select("*")
      .eq("id", authenticatedUser.id)
      .single();

    if (!userData) {
      // Create user profile with admin role (owners sign up directly)
      console.log("[SIGNUP] User profile not found, creating new profile");
      // Create user profile if it doesn't exist
      const { data: newUser, error: userError } = await supabase
        .from("User")
        .insert({
          id: authenticatedUser.id,
          email: authenticatedUser.email!,
          name: validatedData.name || null,
          role: "admin", // Owners who sign up directly are admins
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error("[SIGNUP] Error creating user profile:", userError);
        return NextResponse.json(
          { error: "Failed to create user profile" },
          { status: 500 }
        );
      }

      console.log("[SIGNUP] User profile created successfully:", { userId: newUser.id });
      userData = newUser;

      // Create household member record for the owner (owner is also a household member of themselves)
      console.log("[SIGNUP] Creating household member record for owner:", { userId: newUser.id });
      const invitationToken = crypto.randomUUID();
      const now = new Date().toISOString();
      
      const { error: householdMemberError } = await supabase
        .from("HouseholdMember")
        .insert({
          ownerId: newUser.id,
          memberId: newUser.id,
          email: authenticatedUser.email!,
          name: validatedData.name || null,
          role: "admin", // Owner is admin
          status: "active", // Owner is immediately active
          invitationToken: invitationToken,
          invitedAt: now,
          acceptedAt: now, // Owner accepts immediately
          createdAt: now,
          updatedAt: now,
        });

      if (householdMemberError) {
        console.error("[SIGNUP] Error creating household member record:", householdMemberError);
        // Don't fail signup if household member creation fails, but log it
      } else {
        console.log("[SIGNUP] Household member record created successfully for owner");
      }
    }

    // Note: Subscription will be created when user selects a plan on /select-plan page
    console.log("[SIGNUP] User profile created, subscription will be created on plan selection:", userData.id);

    // If session is still not available, try to get it explicitly
    if (!activeSession) {
      console.log("[SIGNUP] Session still not available, trying to get session explicitly");
      const { data: { session } } = await supabase.auth.getSession();
      activeSession = session;
      console.log("[SIGNUP] Session from getSession:", { hasSession: !!activeSession });
    }

    console.log("[SIGNUP] Final session status:", { 
      hasSession: !!activeSession, 
      hasAccessToken: !!activeSession?.access_token,
      hasRefreshToken: !!activeSession?.refresh_token,
      userId: userData.id 
    });

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
      console.log("[SIGNUP] Setting auth cookies");
      // Set access token cookie
      if (activeSession.access_token) {
        response.cookies.set("sb-access-token", activeSession.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
        console.log("[SIGNUP] Access token cookie set");
      } else {
        console.warn("[SIGNUP] No access token in session");
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
        console.log("[SIGNUP] Refresh token cookie set");
      } else {
        console.warn("[SIGNUP] No refresh token in session");
      }
    } else {
      console.error("[SIGNUP] No session found after sign up and sign in - cannot set cookies!");
    }

    console.log("[SIGNUP] Signup process completed successfully");
    return response;
  } catch (error) {
    console.error("[SIGNUP] Error in sign up:", error);
    
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to sign up" },
      { status: 500 }
    );
  }
}

