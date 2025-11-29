import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../../src/infrastructure/database/supabase-server";

/**
 * GET /api/subscription-services/plans
 * Get active plans for a subscription service (public endpoint)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");

    if (!serviceId) {
      return NextResponse.json(
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get only active plans for the service
    const { data: plans, error } = await supabase
      .from("SubscriptionServicePlan")
      .select("*")
      .eq("serviceId", serviceId)
      .eq("isActive", true)
      .order("planName", { ascending: true });

    if (error) {
      console.error("Error fetching plans:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch plans" },
        { status: 500 }
      );
    }

    return NextResponse.json({ plans: plans || [] });
  } catch (error) {
    console.error("Error in GET /api/subscription-services/plans:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

