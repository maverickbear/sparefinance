import { NextRequest, NextResponse } from "next/server";
import { createPortalSession } from "@/lib/api/stripe";
import { createServerClient } from "../../../../src/infrastructure/database/supabase-server";

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Create portal session
    const { url, error } = await createPortalSession(authUser.id);

    if (error || !url) {
      return NextResponse.json(
        { error: error || "Failed to create portal session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}

