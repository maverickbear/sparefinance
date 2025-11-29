import { NextResponse } from "next/server";
import { acceptInvitation } from "@/lib/api/members";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    const member = await acceptInvitation(token, authUser.id);
    return NextResponse.json(member);
  } catch (error) {
    console.error("Error accepting invitation:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to accept invitation";
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}



