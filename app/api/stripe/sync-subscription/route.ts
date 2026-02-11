import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";
import { getStripeClient } from "@/src/infrastructure/external/stripe/stripe-client";

// Syncs the subscription from Stripe to Supabase (app_subscriptions).
// In sandbox or when the Stripe webhook is not configured, this endpoint is the
// only way the subscription gets created in Supabase after checkout. The success
// page calls this when the user lands on /subscription/success.
export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    console.log("[SYNC] Starting subscription sync");
    const supabase = await createServerClient();
    
    // Get current user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      console.error("[SYNC] Unauthorized:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[SYNC] User authenticated:", { userId: authUser.id });

    // Get user's subscription from Supabase
    // FIX: Use app_subscriptions table (not system.subscriptions) and snake_case column names
    const { data: existingSub, error: subError } = await supabase
      .from("app_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, plan_id, id")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[SYNC] Error fetching subscription:", subError);
    }

    console.log("[SYNC] Existing subscription in Supabase:", {
      exists: !!existingSub,
      hasStripeCustomerId: !!existingSub?.stripe_customer_id,
      hasStripeSubscriptionId: !!existingSub?.stripe_subscription_id,
      planId: existingSub?.plan_id
    });

    // If no customer ID, try to find customer by email
    // FIX: Map snake_case to camelCase for use
    let customerId = existingSub?.stripe_customer_id;
    
    if (!customerId) {
      console.log("[SYNC] No customer ID found, searching Stripe by email:", authUser.email);
      try {
        const customers = await stripe.customers.list({
          email: authUser.email!,
          limit: 10, // Increase limit to find customer even if there are multiple
        });

        if (customers.data.length > 0) {
          // Prefer customer with userId in metadata matching current user
          const customerWithUserId = customers.data.find(
            c => c.metadata?.userId === authUser.id
          );
          customerId = customerWithUserId?.id || customers.data[0].id;
          console.log("[SYNC] Found customer in Stripe:", customerId);
          
          // Update customer metadata if it doesn't have userId
          if (!customerWithUserId && customerId) {
            try {
              await stripe.customers.update(customerId, {
                metadata: {
                  userId: authUser.id,
                },
              });
              console.log("[SYNC] Updated customer metadata with userId");
            } catch (updateError) {
              console.error("[SYNC] Error updating customer metadata:", updateError);
            }
          }
        } else {
          console.log("[SYNC] No customer found in Stripe");
          return NextResponse.json(
            { error: "No Stripe customer found. Please complete checkout first." },
            { status: 404 }
          );
        }
      } catch (error) {
        console.error("[SYNC] Error searching for customer:", error);
        return NextResponse.json(
          { error: "Failed to search for customer" },
          { status: 500 }
        );
      }
    }

    // Get active subscriptions from Stripe
    console.log("[SYNC] Fetching subscriptions from Stripe for customer:", customerId);
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    console.log("[SYNC] Found subscriptions in Stripe:", {
      count: subscriptions.data.length,
      subscriptionIds: subscriptions.data.map(s => s.id)
    });

    if (subscriptions.data.length === 0) {
      console.log("[SYNC] No subscriptions found in Stripe for customer:", customerId);
      // If we have a customer but no subscription, it might still be processing
      // Return a more helpful error message
      return NextResponse.json(
        { 
          error: "No subscriptions found in Stripe. The subscription may still be processing. Please wait a moment and try again.",
          retry: true
        },
        { status: 404 }
      );
    }

    // Get the most recent subscription (prefer active, but use any if active not available)
    const activeSubscription = subscriptions.data.find(s => 
      s.status === "active" || s.status === "trialing"
    ) || subscriptions.data[0];
    
    if (!activeSubscription) {
      console.log("[SYNC] No subscription found");
      return NextResponse.json(
        { error: "No subscription found in Stripe" },
        { status: 404 }
      );
    }

    console.log("[SYNC] Processing subscription:", {
      subscriptionId: activeSubscription.id,
      status: activeSubscription.status,
      priceId: activeSubscription.items.data[0]?.price.id
    });

    // Use service role client to update subscription
    const serviceSupabase = createServiceRoleClient();
    
    // Sync the subscription directly
    const priceId = activeSubscription.items.data[0]?.price.id;
    if (!priceId) {
      console.error("[SYNC] No price ID in subscription");
      return NextResponse.json(
        { error: "No price ID in subscription" },
        { status: 400 }
      );
    }

    // Find plan by price ID
    // FIX: Use app_plans table (not system.plans) and snake_case column names
    const { data: plan, error: planError } = await serviceSupabase
      .from("app_plans")
      .select("id")
      .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
      .single();

    if (planError || !plan) {
      console.error("[SYNC] No plan found for price ID:", { priceId, planError });
      return NextResponse.json(
        { error: "No plan found for price ID" },
        { status: 400 }
      );
    }

    console.log("[SYNC] Found plan:", { planId: plan.id, priceId });

    // Map status using service
    const stripeService = makeStripeService();
    const status = stripeService.mapStripeStatus(activeSubscription.status);
    const subscriptionId = authUser.id + "-" + plan.id;

    // Get active household ID for the user
    let householdId: string | null = null;
    try {
      // Try to get from system_user_active_households first
      // FIX: Use correct table name and snake_case column names
      const { data: activeHousehold } = await serviceSupabase
        .from("system_user_active_households")
        .select("household_id")
        .eq("user_id", authUser.id)
        .maybeSingle();
      
      if (activeHousehold?.household_id) {
        householdId = activeHousehold.household_id;
      } else {
        // Fallback to default (personal) household
        const { data: defaultMember } = await serviceSupabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", authUser.id)
          .eq("is_default", true)
          .eq("status", "active")
          .maybeSingle();
        
        if (defaultMember?.household_id) {
          householdId = defaultMember.household_id;
        }
      }
      
      if (householdId) {
        console.log("[SYNC] Found householdId for user:", { userId: authUser.id, householdId });
      } else {
        console.log("[SYNC] No householdId found for user (will be null):", authUser.id);
      }
    } catch (error) {
      console.error("[SYNC] Error getting householdId:", error);
      // Continue without householdId - it can be set later
    }

    console.log("[SYNC] Subscription data from Stripe:", {
      subscriptionId: activeSubscription.id,
      status: activeSubscription.status,
      trial_start: (activeSubscription as any).trial_start,
      trial_end: (activeSubscription as any).trial_end,
      trial_end_date: (activeSubscription as any).trial_end ? new Date((activeSubscription as any).trial_end * 1000).toISOString() : null,
      current_period_start: (activeSubscription as any).current_period_start,
      current_period_end: (activeSubscription as any).current_period_end,
    });

    console.log("[SYNC] Upserting subscription:", {
      subscriptionId,
      userId: authUser.id,
      householdId,
      planId: plan.id,
      status,
      stripeSubscriptionId: activeSubscription.id,
      stripeCustomerId: customerId
    });


    // Get existing subscription to check if trial should be finalized
    // FIX: Use app_subscriptions table and snake_case column names
    const { data: existingSubData } = await serviceSupabase
      .from("app_subscriptions")
      .select("trial_start_date, trial_end_date, status")
      .eq("id", subscriptionId)
      .maybeSingle();

    const now = new Date().toISOString();
    // For trialing subscriptions Stripe may not set current_period_start/end; use trial dates as fallback
    const subAny = activeSubscription as any;
    const periodStart = subAny.current_period_start ?? subAny.trial_start;
    const periodEnd = subAny.current_period_end ?? subAny.trial_end;
    const toIsoIfValid = (unix: number | undefined): string | null =>
      unix != null && Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : null;

    const currentPeriodStart = toIsoIfValid(periodStart);
    const currentPeriodEnd = toIsoIfValid(periodEnd);
    if (!currentPeriodStart || !currentPeriodEnd) {
      console.warn("[SYNC] Missing period dates from Stripe (trialing?), using fallbacks:", {
        subscriptionId,
        current_period_start: subAny.current_period_start,
        current_period_end: subAny.current_period_end,
        trial_start: subAny.trial_start,
        trial_end: subAny.trial_end,
      });
    }

    // Prepare subscription data (snake_case for app_subscriptions)
    const subscriptionData: any = {
      id: subscriptionId,
      user_id: authUser.id,
      household_id: householdId,
      plan_id: plan.id,
      status: status,
      stripe_subscription_id: activeSubscription.id,
      stripe_customer_id: customerId,
      current_period_start: currentPeriodStart ?? now,
      current_period_end: currentPeriodEnd ?? now,
      cancel_at_period_end: Boolean(subAny.cancel_at_period_end ?? false),
      updated_at: now,
    };
    // Set created_at when inserting a new row (e.g. when webhook was not received)
    if (!existingSubData) {
      subscriptionData.created_at = now;
    }

    // Preserve trial start date if it exists
    if (existingSubData?.trial_start_date) {
      subscriptionData.trial_start_date = existingSubData.trial_start_date;
    } else if ((activeSubscription as any).trial_start) {
      subscriptionData.trial_start_date = new Date((activeSubscription as any).trial_start * 1000).toISOString();
    }

    // If subscription status is "active" and was previously "trialing", finalize trial immediately
    const wasTrialing = existingSubData?.status === "trialing";
    const isNowActive = status === "active";
    const hasTrialEndDate = existingSubData?.trial_end_date || (activeSubscription as any).trial_end;

    if (isNowActive && wasTrialing && hasTrialEndDate) {
      // Payment was made during trial - finalize trial immediately
      const now = new Date().toISOString();
      subscriptionData.trial_end_date = now;
      console.log("[SYNC] Payment made during trial - finalizing trial immediately:", {
        subscriptionId,
        previousStatus: existingSubData?.status,
        newStatus: status,
        previousTrialEndDate: existingSubData?.trial_end_date,
        newTrialEndDate: now,
      });
    } else {
      // Stripe is the source of truth for trial_end - always use it when available
      const stripeTrialEnd = (activeSubscription as any).trial_end;
      console.log("[SYNC] Trial end processing:", {
        subscriptionId,
        stripeTrialEnd,
        stripeTrialEndDate: stripeTrialEnd ? new Date(stripeTrialEnd * 1000).toISOString() : null,
        existingTrialEndDate: existingSubData?.trial_end_date,
        status,
      });
      
      if (stripeTrialEnd) {
        subscriptionData.trial_end_date = new Date(stripeTrialEnd * 1000).toISOString();
        console.log("[SYNC] Using trial_end from Stripe:", {
          subscriptionId,
          trialEndDate: subscriptionData.trial_end_date,
          previousTrialEndDate: existingSubData?.trial_end_date,
          changed: existingSubData?.trial_end_date !== subscriptionData.trial_end_date,
        });
      } else if (existingSubData?.trial_end_date && status === "trialing") {
        // Only preserve existing value if Stripe doesn't have trial_end and status is still trialing
        subscriptionData.trial_end_date = existingSubData.trial_end_date;
        console.log("[SYNC] Preserving existing trialEndDate (Stripe has no trial_end):", {
          subscriptionId,
          trialEndDate: subscriptionData.trial_end_date,
        });
      } else {
        console.log("[SYNC] No trial_end to set:", {
          subscriptionId,
          stripeTrialEnd,
          existingTrialEndDate: existingSubData?.trial_end_date,
          status,
        });
      }
    }

    // Upsert the subscription
    // FIX: Use app_subscriptions table
    const { data: upsertedSub, error: upsertError } = await serviceSupabase
      .from("app_subscriptions")
      .upsert(subscriptionData, {
        onConflict: "id",
      })
      .select();

    if (upsertError) {
      const message = upsertError?.message ?? "Failed to sync subscription";
      console.error("[SYNC] Error upserting subscription:", upsertError);
      return NextResponse.json(
        { error: "Failed to sync subscription", details: process.env.NODE_ENV === "development" ? message : undefined },
        { status: 500 }
      );
    }

    console.log("[SYNC] Subscription synced successfully:", upsertedSub);

    // Invalidate subscription cache to ensure UI reflects changes immediately
    const { makeSubscriptionsService } = await import("@/src/application/subscriptions/subscriptions.factory");
    const subscriptionsService = makeSubscriptionsService();
    console.log("[SYNC] Subscription cache invalidated for user:", authUser.id);

    return NextResponse.json({
      success: true,
      subscription: upsertedSub?.[0],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync subscription";
    console.error("[SYNC] Error syncing subscription:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}

