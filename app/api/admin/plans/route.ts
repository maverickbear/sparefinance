import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "../../../../src/infrastructure/database/supabase-server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { planFeaturesSchema } from "@/src/domain/subscriptions/subscriptions.validations";
import { invalidatePlansCache } from "@/lib/api/subscription";
import { syncPlanToStripe } from "@/lib/api/stripe";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super_admin and fetch plans in parallel
    const supabase = await createServerClient();
    
    // Parallel requests to improve performance
    const [userResult, plansResult] = await Promise.all([
      supabase
        .from("User")
        .select("role")
        .eq("id", userId)
        .single(),
      supabase
        .from("Plan")
        .select("*")
        .order("priceMonthly", { ascending: true })
    ]);

    // Check authorization
    const { data: user, error: userError } = userResult;
    if (userError || !user || user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check plans result
    const { data: plans, error: plansError } = plansResult;
    if (plansError) {
      console.error("Error fetching plans:", plansError);
      return NextResponse.json(
        { error: "Failed to fetch plans" },
        { status: 500 }
      );
    }

    return NextResponse.json({ plans: plans || [] });
  } catch (error) {
    console.error("Error in GET /api/admin/plans:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super_admin
    const supabase = await createServerClient();
    const { data: user, error: userError } = await supabase
      .from("User")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError || !user || user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, features, priceMonthly, priceYearly } = body;

    console.log("[API/ADMIN/PLANS] PUT request received:", {
      id,
      hasName: name !== undefined,
      hasFeatures: features !== undefined,
      hasPriceMonthly: priceMonthly !== undefined,
      hasPriceYearly: priceYearly !== undefined,
    });

    if (!id) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Validate features if provided using centralized service
    if (features) {
      try {
        const { validateFeaturesForSave } = await import("@/lib/api/plan-features-service");
        validateFeaturesForSave(features);
      } catch (error) {
        console.error("[API/ADMIN/PLANS] Feature validation failed:", error);
        return NextResponse.json(
          { 
            error: "Invalid features format", 
            details: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) {
      updateData.name = name;
    }

    if (features !== undefined) {
      updateData.features = features;
    }

    if (priceMonthly !== undefined) {
      updateData.priceMonthly = priceMonthly;
    }

    if (priceYearly !== undefined) {
      updateData.priceYearly = priceYearly;
    }

    console.log("[API/ADMIN/PLANS] Updating plan with data:", updateData);

    // Use service role client to bypass RLS (Plan table requires service role for updates)
    const serviceRoleClient = createServiceRoleClient();
    
    // Update plan
    const { data: updatedPlan, error: updateError } = await serviceRoleClient
      .from("Plan")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    console.log("[API/ADMIN/PLANS] Update result:", {
      success: !updateError,
      error: updateError?.message,
      planId: updatedPlan?.id,
      updatedFeatures: updatedPlan?.features,
    });

    if (updateError) {
      console.error("[API/ADMIN/PLANS] Error updating plan:", updateError);
      return NextResponse.json(
        { 
          error: "Failed to update plan",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    if (!updatedPlan) {
      console.error("[API/ADMIN/PLANS] Plan update returned no data");
      return NextResponse.json(
        { error: "Plan update succeeded but no data returned" },
        { status: 500 }
      );
    }

    // Invalidate plans cache
    await invalidatePlansCache();
    
    // Invalidate subscription cache for all users with this plan
    // This ensures users see updated features immediately
    const { invalidateSubscriptionsForPlan } = await import("@/lib/api/subscription");
    await invalidateSubscriptionsForPlan(id);

    // Sync to Stripe if plan has stripeProductId
    // Sync everything: features, prices, and product name
    if (updatedPlan.stripeProductId) {
      try {
        const syncResult = await syncPlanToStripe(id);
        if (!syncResult.success) {
          console.warn("Stripe sync completed with warnings:", syncResult.warnings);
          // Return success but include warnings in response
          return NextResponse.json({ 
            plan: updatedPlan,
            stripeSync: {
              success: false,
              warnings: syncResult.warnings,
              error: syncResult.error,
            },
          });
        }
      } catch (stripeError) {
        console.error("Error syncing to Stripe (non-fatal):", stripeError);
        // Don't fail the request if Stripe sync fails, but log it
        return NextResponse.json({ 
          plan: updatedPlan,
          stripeSync: {
            success: false,
            error: stripeError instanceof Error ? stripeError.message : "Unknown error",
          },
        });
      }
    }

    return NextResponse.json({ 
      plan: updatedPlan,
      stripeSync: { success: true },
    });
  } catch (error) {
    console.error("Error in PUT /api/admin/plans:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

