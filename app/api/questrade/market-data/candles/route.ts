import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserId } from "@/lib/api/feature-guard";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const securityId = searchParams.get("securityId");
    const interval = searchParams.get("interval") || "OneDay";
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!securityId) {
      return NextResponse.json(
        { error: "securityId is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get candles from database
    const { data: candles, error } = await supabase
      .from("Candle")
      .select("*")
      .eq("securityId", securityId)
      .eq("interval", interval)
      .order("start", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching candles:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch candles" },
        { status: 500 }
      );
    }

    return NextResponse.json({ candles: candles || [] });
  } catch (error: any) {
    console.error("Error fetching candles:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch candles" },
      { status: 500 }
    );
  }
}

