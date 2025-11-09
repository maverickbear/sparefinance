import { NextResponse } from "next/server";
import { getPlans, getCurrentUserSubscription } from "@/lib/api/plans";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  console.log("[API/BILLING/PLANS] GET request received");
  try {
    console.log("[API/BILLING/PLANS] Fetching plans");
    const plans = await getPlans();
    console.log("[API/BILLING/PLANS] Plans fetched:", plans.length, "plans");

    // Get current user's plan
    let currentPlanId: string | undefined;
    try {
      console.log("[API/BILLING/PLANS] Creating server client");
      const supabase = await createServerClient();
      console.log("[API/BILLING/PLANS] Getting user");
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      // If user is not authenticated, return 401
      if (authError || !authUser) {
        console.log("[API/BILLING/PLANS] User not authenticated:", { authError: authError?.message, hasUser: !!authUser });
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      
      console.log("[API/BILLING/PLANS] User authenticated:", authUser.id);
      // User is authenticated, get their subscription
      console.log("[API/BILLING/PLANS] Getting current user subscription");
      const subscription = await getCurrentUserSubscription();
      console.log("[API/BILLING/PLANS] Subscription:", subscription);
      // getUserSubscription returns null if user has no subscription
      // User must select a plan on /select-plan page
      if (subscription) {
        currentPlanId = subscription.planId;
        console.log("[API/BILLING/PLANS] Current plan ID:", currentPlanId);
      } else {
        // If subscription is null, user is authenticated but no subscription found
        // Return undefined so user can select a plan
        currentPlanId = undefined;
        console.log("[API/BILLING/PLANS] No subscription found, user must select a plan");
      }
    } catch (error) {
      // Error occurred, return 401 to force login
      console.error("[API/BILLING/PLANS] Error checking authentication:", error);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[API/BILLING/PLANS] Returning response:", { plansCount: plans.length, currentPlanId });
    return NextResponse.json({
      plans,
      currentPlanId,
    });
  } catch (error) {
    console.error("[API/BILLING/PLANS] Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

