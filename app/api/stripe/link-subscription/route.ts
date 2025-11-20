import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getActiveHouseholdId } from "@/lib/utils/household";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

/**
 * POST /api/stripe/link-subscription
 * Links a Stripe subscription to a user account by email
 * Used when a user signs up after completing checkout
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    // Get current user
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify that the email matches the authenticated user
    if (authUser.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email does not match authenticated user" },
        { status: 400 }
      );
    }

    // Find Stripe customer by email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: "No Stripe customer found with this email" },
        { status: 404 }
      );
    }

    const customer = customers.data[0];
    const customerId = customer.id;

    // Find active subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: "No subscription found for this customer" },
        { status: 404 }
      );
    }

    const stripeSubscription = subscriptions.data[0];

    // Get price ID to find plan
    const priceId = stripeSubscription.items.data[0]?.price.id;
    if (!priceId) {
      return NextResponse.json(
        { error: "No price ID found in subscription" },
        { status: 400 }
      );
    }

    // Find plan by price ID
    const { data: plan, error: planError } = await supabase
      .from("Plan")
      .select("id")
      .or(`stripePriceIdMonthly.eq.${priceId},stripePriceIdYearly.eq.${priceId}`)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan not found for this subscription" },
        { status: 404 }
      );
    }

    // Get user name from User table
    const { data: userData } = await supabase
      .from("User")
      .select("name")
      .eq("id", authUser.id)
      .single();

    // Get active household ID for the user
    const householdId = await getActiveHouseholdId(authUser.id);
    if (!householdId) {
      console.error("[LINK-SUBSCRIPTION] No active household found for user:", authUser.id);
      return NextResponse.json(
        { error: "No active household found. Please contact support." },
        { status: 400 }
      );
    }

    // Update customer with email, name, and metadata
    await stripe.customers.update(customerId, {
      email: authUser.email!,
      name: userData?.name || undefined,
      metadata: {
        userId: authUser.id,
      },
    });

    // Check if subscription already exists by userId+planId OR by stripeCustomerId OR by pendingEmail
    // This handles both cases: existing subscription or pending subscription from webhook
    const subscriptionId = authUser.id + "-" + plan.id;
    
    // First, check if there's a pending subscription with this email (created by webhook before signup)
    const { data: pendingSubByEmail } = await supabase
      .from("Subscription")
      .select("id, userId, stripeCustomerId")
      .eq("pendingEmail", email.toLowerCase())
      .is("userId", null)
      .maybeSingle();
    
    // Check if there's a subscription with this stripeCustomerId
    const { data: existingSubByCustomer } = await supabase
      .from("Subscription")
      .select("id, userId")
      .eq("stripeCustomerId", customerId)
      .maybeSingle();
    
    // Also check by subscription ID
    const { data: existingSubById } = await supabase
      .from("Subscription")
      .select("id, userId")
      .eq("id", subscriptionId)
      .maybeSingle();

    // Prefer pending subscription by email, then by customer ID, then by subscription ID
    const existingSub = pendingSubByEmail || existingSubByCustomer || existingSubById;

    if (existingSub) {
      // Update existing subscription (could be from webhook or previous link attempt)
      const updateData: any = {
        id: subscriptionId, // Ensure correct ID format
        userId: authUser.id, // Ensure userId is set (link pending subscription)
        householdId: householdId, // Link to active household
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customerId,
        status: stripeSubscription.status === "active" ? "active" : 
                stripeSubscription.status === "trialing" ? "trialing" :
                stripeSubscription.status === "past_due" ? "past_due" : "cancelled",
        currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialStartDate: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trialEndDate: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        pendingEmail: null, // Clear pending email when linking
        updatedAt: new Date(),
      };

      // If updating a subscription with different ID (e.g., pending subscription), we need to delete the old one and create new
      if (existingSub.id !== subscriptionId) {
        console.log("[LINK-SUBSCRIPTION] Subscription ID mismatch, will recreate with correct ID:", {
          oldId: existingSub.id,
          newId: subscriptionId,
          wasPending: !existingSub.userId
        });
        
        // Delete old subscription (could be pending subscription)
        await supabase
          .from("Subscription")
          .delete()
          .eq("id", existingSub.id);
        
        // Create new subscription with correct ID
        const { error: insertError } = await supabase
          .from("Subscription")
          .insert(updateData);

        if (insertError) {
          console.error("[LINK-SUBSCRIPTION] Error creating subscription:", insertError);
          return NextResponse.json(
            { error: "Failed to create subscription" },
            { status: 500 }
          );
        }
        
        console.log("[LINK-SUBSCRIPTION] Pending subscription linked successfully:", {
          oldId: existingSub.id,
          newId: subscriptionId,
          email
        });
      } else {
        // Update existing subscription
        const { error: updateError } = await supabase
          .from("Subscription")
          .update(updateData)
          .eq("id", subscriptionId);

        if (updateError) {
          console.error("[LINK-SUBSCRIPTION] Error updating subscription:", updateError);
          return NextResponse.json(
            { error: "Failed to update subscription" },
            { status: 500 }
          );
        }
        
        if (!existingSub.userId) {
          console.log("[LINK-SUBSCRIPTION] Pending subscription linked successfully:", {
            subscriptionId,
            email
          });
        }
      }
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from("Subscription")
        .insert({
          id: subscriptionId,
          userId: authUser.id,
          householdId: householdId, // Link to active household
          planId: plan.id,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId: customerId,
          status: stripeSubscription.status === "active" ? "active" : 
                  stripeSubscription.status === "trialing" ? "trialing" :
                  stripeSubscription.status === "past_due" ? "past_due" : "cancelled",
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          trialStartDate: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trialEndDate: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        });

      if (insertError) {
        console.error("[LINK-SUBSCRIPTION] Error creating subscription:", insertError);
        return NextResponse.json(
          { error: "Failed to create subscription" },
          { status: 500 }
        );
      }
    }

    // Invalidate cache
    const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
    await invalidateSubscriptionCache(authUser.id);

    return NextResponse.json({ 
      success: true,
      message: "Subscription linked successfully"
    });
  } catch (error) {
    console.error("[LINK-SUBSCRIPTION] Error:", error);
    return NextResponse.json(
      { error: "Failed to link subscription" },
      { status: 500 }
    );
  }
}

