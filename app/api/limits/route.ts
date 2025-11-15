import { NextResponse } from "next/server";
import { getCurrentUserLimits } from "@/lib/api/limits";
import { getCurrentUserId } from "@/lib/api/feature-guard";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limits = await getCurrentUserLimits();
    return NextResponse.json(limits);
  } catch (error: any) {
    console.error("Error getting user limits:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get user limits" },
      { status: 500 }
    );
  }
}

