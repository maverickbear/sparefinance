import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../src/infrastructure/database/supabase-server";
import { createServiceRoleClient } from "../../../src/infrastructure/database/supabase-server";

/**
 * POST /api/auth/create-user-profile
 * Creates user profile in User table using service role (bypasses RLS)
 * This is called after signup to ensure the user profile is created even if
 * the session isn't fully established yet
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, name, avatarUrl } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { error: "userId and email are required" },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const serviceRoleClient = createServiceRoleClient();

    // Check if user already exists
    const { data: existingUser } = await serviceRoleClient
      .from("User")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ 
        success: true,
        message: "User profile already exists",
        user: existingUser
      });
    }

    // Create user profile using service role (bypasses RLS)
    const { data: userData, error: userError } = await serviceRoleClient
      .from("User")
      .insert({
        id: userId,
        email: email,
        name: name || null,
        avatarUrl: avatarUrl || null,
        role: "admin", // Owners who sign up directly are admins
      })
      .select()
      .single();

    if (userError) {
      console.error("[CREATE-USER-PROFILE] Error creating user:", {
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
        code: userError.code,
        userId,
        email,
      });

      // If it's a duplicate key error, try to fetch the existing user
      if (userError.code === "23505" || 
          userError.message?.includes("duplicate") || 
          userError.message?.includes("unique")) {
        const { data: existingUser } = await serviceRoleClient
          .from("User")
          .select("*")
          .eq("id", userId)
          .single();

        if (existingUser) {
          return NextResponse.json({ 
            success: true,
            message: "User profile already exists (fetched after duplicate error)",
            user: existingUser
          });
        }
      }

      return NextResponse.json(
        { error: "Failed to create user profile", details: userError.message },
        { status: 500 }
      );
    }

    // Note: Welcome email will be sent when subscription is created (see subscription creation handlers)

    return NextResponse.json({ 
      success: true,
      message: "User profile created successfully",
      user: userData
    });
  } catch (error) {
    console.error("[CREATE-USER-PROFILE] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

