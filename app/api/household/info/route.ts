import { NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getUserHouseholdInfo } from "@/lib/api/members";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const householdInfo = await getUserHouseholdInfo(user.id);

    return NextResponse.json(householdInfo);
  } catch (error) {
    console.error("Error fetching household info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

