import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { mapStripeStatus } from "@/lib/api/stripe";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

// This endpoint syncs the subscription from Stripe to Supabase
// It can be called after checkout to ensure subscription is created
export async function POST(request: NextRequest) {
  try {
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
    const { data: existingSub, error: subError } = await supabase
      .from("Subscription")
      .select("stripeCustomerId, stripeSubscriptionId, planId, id")
      .eq("userId", authUser.id)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[SYNC] Error fetching subscription:", subError);
    }

    console.log("[SYNC] Existing subscription in Supabase:", {
      exists: !!existingSub,
      hasStripeCustomerId: !!existingSub?.stripeCustomerId,
      hasStripeSubscriptionId: !!existingSub?.stripeSubscriptionId,
      planId: existingSub?.planId
    });

    // If no customer ID, try to find customer by email
    let customerId = existingSub?.stripeCustomerId;
    
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
    const { data: plan, error: planError } = await serviceSupabase
      .from("Plan")
      .select("id")
      .or(`stripePriceIdMonthly.eq.${priceId},stripePriceIdYearly.eq.${priceId}`)
      .single();

    if (planError || !plan) {
      console.error("[SYNC] No plan found for price ID:", { priceId, planError });
      return NextResponse.json(
        { error: "No plan found for price ID" },
        { status: 400 }
      );
    }

    console.log("[SYNC] Found plan:", { planId: plan.id, priceId });

    // Map status using shared function
    const status = await mapStripeStatus(activeSubscription.status);
    const subscriptionId = authUser.id + "-" + plan.id;

    // Get active household ID for the user
    let householdId: string | null = null;
    try {
      // Try to get from UserActiveHousehold first
      const { data: activeHousehold } = await serviceSupabase
        .from("UserActiveHousehold")
        .select("householdId")
        .eq("userId", authUser.id)
        .maybeSingle();
      
      if (activeHousehold?.householdId) {
        householdId = activeHousehold.householdId;
      } else {
        // Fallback to default (personal) household
        const { data: defaultMember } = await serviceSupabase
          .from("HouseholdMemberNew")
          .select("householdId")
          .eq("userId", authUser.id)
          .eq("isDefault", true)
          .eq("status", "active")
          .maybeSingle();
        
        if (defaultMember?.householdId) {
          householdId = defaultMember.householdId;
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
    const { data: existingSubData } = await serviceSupabase
      .from("Subscription")
      .select("trialStartDate, trialEndDate, status")
      .eq("id", subscriptionId)
      .maybeSingle();

    // Prepare subscription data
    const subscriptionData: any = {
      id: subscriptionId,
      userId: authUser.id,
      householdId: householdId, // Link to active household (null if not found)
      planId: plan.id,
      status: status,
      stripeSubscriptionId: activeSubscription.id,
      stripeCustomerId: customerId,
      currentPeriodStart: new Date((activeSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((activeSubscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (activeSubscription as any).cancel_at_period_end,
      updatedAt: new Date(),
    };

    // Preserve trial start date if it exists
    if (existingSubData?.trialStartDate) {
      subscriptionData.trialStartDate = existingSubData.trialStartDate;
    } else if ((activeSubscription as any).trial_start) {
      subscriptionData.trialStartDate = new Date((activeSubscription as any).trial_start * 1000);
    }

    // If subscription status is "active" and was previously "trialing", finalize trial immediately
    const wasTrialing = existingSubData?.status === "trialing";
    const isNowActive = status === "active";
    const hasTrialEndDate = existingSubData?.trialEndDate || (activeSubscription as any).trial_end;

    if (isNowActive && wasTrialing && hasTrialEndDate) {
      // Payment was made during trial - finalize trial immediately
      const now = new Date();
      subscriptionData.trialEndDate = now;
      console.log("[SYNC] Payment made during trial - finalizing trial immediately:", {
        subscriptionId,
        previousStatus: existingSubData?.status,
        newStatus: status,
        previousTrialEndDate: existingSubData?.trialEndDate,
        newTrialEndDate: now,
      });
    } else {
      // Stripe is the source of truth for trial_end - always use it when available
      const stripeTrialEnd = (activeSubscription as any).trial_end;
      console.log("[SYNC] Trial end processing:", {
        subscriptionId,
        stripeTrialEnd,
        stripeTrialEndDate: stripeTrialEnd ? new Date(stripeTrialEnd * 1000).toISOString() : null,
        existingTrialEndDate: existingSubData?.trialEndDate,
        status,
      });
      
      if (stripeTrialEnd) {
        subscriptionData.trialEndDate = new Date(stripeTrialEnd * 1000);
        console.log("[SYNC] Using trial_end from Stripe:", {
          subscriptionId,
          trialEndDate: subscriptionData.trialEndDate.toISOString(),
          previousTrialEndDate: existingSubData?.trialEndDate,
          changed: existingSubData?.trialEndDate !== subscriptionData.trialEndDate.toISOString(),
        });
      } else if (existingSubData?.trialEndDate && status === "trialing") {
        // Only preserve existing value if Stripe doesn't have trial_end and status is still trialing
        subscriptionData.trialEndDate = existingSubData.trialEndDate;
        console.log("[SYNC] Preserving existing trialEndDate (Stripe has no trial_end):", {
          subscriptionId,
          trialEndDate: subscriptionData.trialEndDate,
        });
      } else {
        console.log("[SYNC] No trial_end to set:", {
          subscriptionId,
          stripeTrialEnd,
          existingTrialEndDate: existingSubData?.trialEndDate,
          status,
        });
      }
    }

    // Upsert the subscription
    const { data: upsertedSub, error: upsertError } = await serviceSupabase
      .from("Subscription")
      .upsert(subscriptionData, {
        onConflict: "id",
      })
      .select();

    if (upsertError) {
      console.error("[SYNC] Error upserting subscription:", upsertError);
      return NextResponse.json(
        { error: "Failed to sync subscription" },
        { status: 500 }
      );
    }

    console.log("[SYNC] Subscription synced successfully:", upsertedSub);

    // Invalidate subscription cache to ensure UI reflects changes immediately
    const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
    await invalidateSubscriptionCache(authUser.id);
    console.log("[SYNC] Subscription cache invalidated for user:", authUser.id);

    return NextResponse.json({
      success: true,
      subscription: upsertedSub?.[0],
    });
  } catch (error) {
    console.error("[SYNC] Error syncing subscription:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription" },
      { status: 500 }
    );
  }
}

