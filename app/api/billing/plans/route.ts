import { NextResponse } from "next/server";
import { getPlans, getCurrentUserSubscription } from "@/lib/api/plans";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const plans = await getPlans();

    // Get current user's plan
    let currentPlanId: string | undefined;
    try {
      const supabase = await createServerClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      // If user is not authenticated, return 401
      if (authError || !authUser) {
        console.log("[BILLING/PLANS] User not authenticated");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      
      // User is authenticated, get their subscription
      const subscription = await getCurrentUserSubscription();
      // getUserSubscription always returns a subscription (at least "free" as default)
      // So subscription should never be null if user is authenticated
      // But if it is null due to an error, default to "free"
      if (subscription) {
        currentPlanId = subscription.planId;
      } else {
        // If subscription is null, user is authenticated but no subscription found
        // Default to free plan
        currentPlanId = "free";
      }
    } catch (error) {
      // Error occurred, return 401 to force login
      console.error("[BILLING/PLANS] Error checking authentication:", error);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      plans,
      currentPlanId,
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

