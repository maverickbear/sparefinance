import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../src/infrastructure/database/supabase-server";
import { createServiceRoleClient } from "../../../src/infrastructure/database/supabase-server";

/**
 * POST /api/auth/update-user-metadata
 * Updates user_metadata in Supabase Auth with the name from User table
 * This ensures the Display name appears correctly in Supabase Auth dashboard
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get user name from User table
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("name")
      .eq("id", authUser.id)
      .single();

    if (userError || !userData) {
      console.error("[UPDATE-USER-METADATA] Error fetching user:", userError);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Update user_metadata in Supabase Auth using service role client
    // This requires admin privileges
    // Use both 'name' and 'full_name' for compatibility
    const serviceRoleClient = createServiceRoleClient();
    
    const { data: updatedUser, error: updateError } = await serviceRoleClient.auth.admin.updateUserById(
      authUser.id,
      {
        user_metadata: {
          ...authUser.user_metadata,
          name: userData.name || "",
          full_name: userData.name || "",
        },
      }
    );

    if (updateError) {
      console.error("[UPDATE-USER-METADATA] Error updating user metadata:", updateError);
      return NextResponse.json(
        { error: "Failed to update user metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "User metadata updated successfully"
    });
  } catch (error) {
    console.error("[UPDATE-USER-METADATA] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

