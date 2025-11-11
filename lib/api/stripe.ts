"use server";

import Stripe from "stripe";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase-server";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export interface CheckoutSessionData {
  planId: string;
  priceId: string; // monthly or yearly
  mode: "subscription";
}

export async function createCheckoutSession(
  userId: string,
  planId: string,
  interval: "month" | "year" = "month",
  returnUrl?: string,
  promoCode?: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    console.log("[CHECKOUT] Starting checkout session creation:", { userId, planId, interval });
    const supabase = await createServerClient();
    
    // Get user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser || authUser.id !== userId) {
      console.error("[CHECKOUT] Unauthorized:", { authError, authUser: !!authUser, userId });
      return { url: null, error: "Unauthorized" };
    }
    console.log("[CHECKOUT] User authenticated:", { userId: authUser.id, email: authUser.email });

    // Get plan
    const { data: plan, error: planError } = await supabase
      .from("Plan")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("[CHECKOUT] Plan not found:", { planId, planError });
      return { url: null, error: "Plan not found" };
    }
    console.log("[CHECKOUT] Plan found:", { planId: plan.id, name: plan.name });

    const priceId = interval === "month" 
      ? plan.stripePriceIdMonthly 
      : plan.stripePriceIdYearly;

    if (!priceId) {
      console.error("[CHECKOUT] Stripe price ID not configured:", { planId, interval });
      return { url: null, error: "Stripe price ID not configured for this plan" };
    }
    console.log("[CHECKOUT] Using price ID:", { priceId, interval });

    // Get or create Stripe customer
    let customerId: string;
    const { data: subscription, error: subError } = await supabase
      .from("Subscription")
      .select("stripeCustomerId, id, planId")
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[CHECKOUT] Error fetching subscription:", subError);
    }
    console.log("[CHECKOUT] Existing subscription:", { 
      exists: !!subscription, 
      subscriptionId: subscription?.id,
      planId: subscription?.planId,
      hasStripeCustomerId: !!subscription?.stripeCustomerId 
    });

    if (subscription?.stripeCustomerId) {
      customerId = subscription.stripeCustomerId;
      console.log("[CHECKOUT] Using existing Stripe customer:", customerId);
    } else {
      // Create Stripe customer
      console.log("[CHECKOUT] Creating new Stripe customer for user:", userId);
      const customer = await stripe.customers.create({
        email: authUser.email!,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;
      console.log("[CHECKOUT] Stripe customer created:", { customerId, email: authUser.email });

      // If user has an existing subscription (free), update it with customer ID
      // Otherwise, the webhook will create the subscription when payment succeeds
      if (subscription) {
        console.log("[CHECKOUT] Updating existing subscription with customer ID:", subscription.id);
        const { error: updateError } = await supabase
          .from("Subscription")
          .update({ stripeCustomerId: customerId })
          .eq("id", subscription.id);
        
        if (updateError) {
          console.error("[CHECKOUT] Error updating subscription with customer ID:", updateError);
        } else {
          console.log("[CHECKOUT] Subscription updated with customer ID successfully");
        }
      } else {
        console.log("[CHECKOUT] No existing subscription found. Webhook will create subscription after payment.");
      }
    }

    // Get promo code if provided
    let stripeCouponId: string | undefined;
    if (promoCode) {
      console.log("[CHECKOUT] Looking up promo code:", promoCode);
      const { data: promoCodeData, error: promoError } = await supabase
        .from("PromoCode")
        .select("stripeCouponId, isActive, expiresAt, planIds")
        .eq("code", promoCode.toUpperCase())
        .single();

      if (!promoError && promoCodeData) {
        // Check if promo code is active
        if (!promoCodeData.isActive) {
          console.log("[CHECKOUT] Promo code is not active:", promoCode);
          return { url: null, error: "Promo code is not active" };
        }

        // Check if expired
        if (promoCodeData.expiresAt && new Date(promoCodeData.expiresAt) < new Date()) {
          console.log("[CHECKOUT] Promo code has expired:", promoCode);
          return { url: null, error: "Promo code has expired" };
        }

        // Check if plan is allowed (if planIds is specified)
        const planIds = (promoCodeData.planIds || []) as string[];
        if (planIds.length > 0 && !planIds.includes(planId)) {
          console.log("[CHECKOUT] Promo code not valid for this plan:", { promoCode, planId });
          return { url: null, error: "Promo code not valid for this plan" };
        }

        stripeCouponId = promoCodeData.stripeCouponId || undefined;
        console.log("[CHECKOUT] Promo code found:", { promoCode, stripeCouponId });
      } else {
        console.log("[CHECKOUT] Promo code not found:", promoCode);
        return { url: null, error: "Promo code not found" };
      }
    }

    // Create checkout session
    console.log("[CHECKOUT] Creating Stripe checkout session:", { customerId, priceId, planId, promoCode, stripeCouponId });
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/"}/welcome?plan=paid`,
      cancel_url: returnUrl ? `${returnUrl}?canceled=true` : `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/"}/select-plan?canceled=true`,
      metadata: {
        userId: userId,
        planId: planId,
        interval: interval,
      },
    };

    // Add discount if promo code is provided
    if (stripeCouponId) {
      sessionParams.discounts = [{ coupon: stripeCouponId }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("[CHECKOUT] Checkout session created successfully:", { 
      sessionId: session.id, 
      url: session.url,
      subscriptionId: session.subscription,
      customerId 
    });

    return { url: session.url, error: null };
  } catch (error) {
    console.error("[CHECKOUT] Error creating checkout session:", error);
    return { 
      url: null, 
      error: error instanceof Error ? error.message : "Failed to create checkout session" 
    };
  }
}

export async function createPortalSession(userId: string): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = await createServerClient();
    
    // Get user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser || authUser.id !== userId) {
      return { url: null, error: "Unauthorized" };
    }

    // Get subscription with stripeCustomerId
    const { data: subscription, error: subError } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("userId", userId)
      .not("stripeCustomerId", "is", null)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[PORTAL] Error fetching subscription:", subError);
      return { url: null, error: "Failed to fetch subscription" };
    }

    if (!subscription?.stripeCustomerId) {
      console.log("[PORTAL] No subscription with Stripe customer ID found for user:", userId);
      return { url: null, error: "No active subscription found" };
    }

    console.log("[PORTAL] Found subscription with customer ID:", subscription.stripeCustomerId);

    // Create portal configuration inline if needed
    let configuration: Stripe.BillingPortal.Configuration | null = null;
    
    try {
      // Try to get or create a default configuration
      const configurations = await stripe.billingPortal.configurations.list({ limit: 1 });
      
      if (configurations.data.length > 0) {
        configuration = configurations.data[0];
      } else {
        // Create a new configuration with subscription management features
        configuration = await stripe.billingPortal.configurations.create({
          features: {
            customer_update: {
              enabled: true,
              allowed_updates: ["email", "address", "phone", "tax_id"],
            },
            payment_method_update: {
              enabled: true,
            },
            subscription_cancel: {
              enabled: true,
              mode: "at_period_end",
              cancellation_reason: {
                enabled: true,
                options: [
                  "too_expensive",
                  "missing_features",
                  "switched_service",
                  "unused",
                  "customer_service",
                  "too_complex",
                  "low_quality",
                  "other",
                ],
              },
            },
            subscription_update: {
              enabled: true,
              default_allowed_updates: ["price", "quantity", "promotion_code"],
              proration_behavior: "always_invoice",
            },
          },
          business_profile: {
            headline: "Manage your Spare Finance subscription",
          },
        });
      }
    } catch (configError) {
      console.error("Error handling portal configuration:", configError);
      // Continue without configuration - Stripe will use default if available
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/"}/settings`,
      ...(configuration && { configuration: configuration.id }),
    });

    return { url: session.url, error: null };
  } catch (error) {
    console.error("Error creating portal session:", error);
    return { 
      url: null, 
      error: error instanceof Error ? error.message : "Failed to create portal session" 
    };
  }
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[WEBHOOK] Received webhook event:", { 
      type: event.type, 
      id: event.id,
      livemode: event.livemode 
    });

    // Use service role client for webhooks to bypass RLS
    const supabase = createServiceRoleClient();
    console.log("[WEBHOOK] Service role client created");

    switch (event.type) {
      case "checkout.session.completed": {
        console.log("[WEBHOOK] Processing checkout.session.completed");
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(supabase, session);
        break;
      }

      case "customer.subscription.created": {
        console.log("[WEBHOOK] Processing customer.subscription.created");
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, subscription);
        break;
      }

      case "customer.subscription.updated": {
        console.log("[WEBHOOK] Processing customer.subscription.updated");
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        console.log("[WEBHOOK] Processing customer.subscription.deleted");
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeletion(supabase, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        console.log("[WEBHOOK] Processing invoice.payment_succeeded");
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        console.log("[WEBHOOK] Processing invoice.payment_failed");
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }

      default:
        console.log("[WEBHOOK] Unhandled event type:", event.type);
    }

    console.log("[WEBHOOK] Webhook event processed successfully:", event.type);
    return { success: true };
  } catch (error) {
    console.error("[WEBHOOK] Error handling webhook event:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to handle webhook event" 
    };
  }
}

async function handleCheckoutSessionCompleted(
  supabase: ReturnType<typeof createServiceRoleClient>,
  session: Stripe.Checkout.Session
) {
  // This event is fired when checkout is completed
  // The subscription might not be created yet, so we'll wait for customer.subscription.created
  // But we can update customer ID if needed
  console.log("[WEBHOOK:CHECKOUT] Checkout session completed:", { 
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
    mode: session.mode,
    metadata: session.metadata 
  });
  
  if (session.mode === "subscription" && session.subscription) {
    console.log("[WEBHOOK:CHECKOUT] Retrieving subscription from Stripe:", session.subscription);
    // Retrieve the subscription to trigger the subscription.created/updated event
    // This ensures handleSubscriptionChange is called
    try {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      console.log("[WEBHOOK:CHECKOUT] Subscription retrieved from Stripe:", {
        subscriptionId: subscription.id,
        status: subscription.status,
        customerId: subscription.customer,
        priceId: subscription.items.data[0]?.price.id
      });
      await handleSubscriptionChange(supabase, subscription);
    } catch (error) {
      console.error("[WEBHOOK:CHECKOUT] Error retrieving subscription from checkout session:", error);
    }
  } else {
    console.log("[WEBHOOK:CHECKOUT] No subscription in checkout session or mode is not subscription:", {
      mode: session.mode,
      hasSubscription: !!session.subscription
    });
  }
}

async function handleSubscriptionChange(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  console.log("[WEBHOOK:SUBSCRIPTION] Processing subscription change:", {
    subscriptionId: subscription.id,
    customerId,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price.id
  });
  
  // First, try to find user by existing subscription with customer ID
  let userId: string | null = null;
  console.log("[WEBHOOK:SUBSCRIPTION] Looking for existing subscription with customer ID:", customerId);
  const { data: existingSub, error: existingSubError } = await supabase
    .from("Subscription")
    .select("userId")
    .eq("stripeCustomerId", customerId)
    .limit(1)
    .maybeSingle();

  if (existingSubError) {
    console.error("[WEBHOOK:SUBSCRIPTION] Error fetching existing subscription:", existingSubError);
  }

  if (existingSub) {
    userId = existingSub.userId;
    console.log("[WEBHOOK:SUBSCRIPTION] Found userId from existing subscription:", userId);
  } else {
    console.log("[WEBHOOK:SUBSCRIPTION] No existing subscription found, trying to get userId from Stripe customer metadata");
    // If not found, try to get userId from Stripe customer metadata
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && typeof customer !== "string" && !customer.deleted && customer.metadata?.userId) {
        userId = customer.metadata.userId;
        console.log("[WEBHOOK:SUBSCRIPTION] Found userId from Stripe customer metadata:", userId);
      } else {
        console.log("[WEBHOOK:SUBSCRIPTION] Customer metadata does not contain userId:", {
          isString: typeof customer === "string",
          isDeleted: typeof customer !== "string" && customer.deleted,
          metadata: typeof customer !== "string" && !customer.deleted ? customer.metadata : null
        });
      }
    } catch (error) {
      console.error("[WEBHOOK:SUBSCRIPTION] Error retrieving customer from Stripe:", error);
    }

    if (!userId) {
      console.error("[WEBHOOK:SUBSCRIPTION] No user found for customer:", customerId);
      return;
    }
  }

  // Get plan from price ID
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    console.error("[WEBHOOK:SUBSCRIPTION] No price ID in subscription");
    return;
  }
  console.log("[WEBHOOK:SUBSCRIPTION] Using price ID:", priceId);

  // Find plan by price ID
  console.log("[WEBHOOK:SUBSCRIPTION] Looking for plan with price ID:", priceId);
  const { data: plan, error: planError } = await supabase
    .from("Plan")
    .select("id")
    .or(`stripePriceIdMonthly.eq.${priceId},stripePriceIdYearly.eq.${priceId}`)
    .single();

  if (planError || !plan) {
    console.error("[WEBHOOK:SUBSCRIPTION] No plan found for price ID:", { priceId, planError });
    return;
  }

  console.log("[WEBHOOK:SUBSCRIPTION] Found plan for price ID:", {
    priceId,
    planId: plan.id,
  });

  // Update or create subscription
  const status = mapStripeStatus(subscription.status);
  const subscriptionId = userId + "-" + plan.id;
  
  console.log("[WEBHOOK:SUBSCRIPTION] Preparing to upsert subscription:", {
    subscriptionId,
    userId,
    planId: plan.id,
    status,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    priceId,
  });

  // Cancel any other active subscriptions for this user (only one active subscription per user)
  console.log("[WEBHOOK:SUBSCRIPTION] Looking for other active subscriptions to cancel for user:", userId);
  const { data: otherSubs, error: otherSubsError } = await supabase
    .from("Subscription")
    .select("id")
    .eq("userId", userId)
    .in("status", ["active", "trialing"])
    .neq("id", subscriptionId);

  if (otherSubsError) {
    console.error("[WEBHOOK:SUBSCRIPTION] Error fetching other subscriptions:", otherSubsError);
  }

  if (!otherSubsError && otherSubs && otherSubs.length > 0) {
    const otherSubIds = otherSubs.map(sub => sub.id);
    console.log("[WEBHOOK:SUBSCRIPTION] Cancelling other active subscriptions:", otherSubIds);
    const { error: cancelError } = await supabase
      .from("Subscription")
      .update({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .in("id", otherSubIds);
    
    if (cancelError) {
      console.error("[WEBHOOK:SUBSCRIPTION] Error cancelling other subscriptions:", cancelError);
    } else {
      console.log("[WEBHOOK:SUBSCRIPTION] Successfully cancelled other subscriptions:", otherSubIds);
    }
  } else {
    console.log("[WEBHOOK:SUBSCRIPTION] No other active subscriptions found to cancel");
  }

  // Upsert the new paid subscription
  console.log("[WEBHOOK:SUBSCRIPTION] Upserting subscription to database...");
  const { data: upsertedSub, error: upsertError } = await supabase
    .from("Subscription")
    .upsert({
      id: subscriptionId,
      userId: userId,
      planId: plan.id,
      status: status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      updatedAt: new Date(),
    }, {
      onConflict: "id",
    })
    .select();

  if (upsertError) {
    console.error("[WEBHOOK:SUBSCRIPTION] Error upserting subscription:", upsertError);
    throw upsertError;
  }

  console.log("[WEBHOOK:SUBSCRIPTION] Subscription upserted successfully:", {
    subscriptionId,
    upsertedData: upsertedSub
  });
}

async function handleSubscriptionDeletion(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  console.log("[WEBHOOK:DELETION] Processing subscription deletion:", {
    subscriptionId: subscription.id,
    customerId
  });
  
  // Update subscription to cancelled and change to free plan
  const { data: existingSub, error: existingSubError } = await supabase
    .from("Subscription")
    .select("userId")
    .eq("stripeCustomerId", customerId)
    .limit(1)
    .maybeSingle();

  if (existingSubError) {
    console.error("[WEBHOOK:DELETION] Error fetching existing subscription:", existingSubError);
  }

  if (existingSub) {
    console.log("[WEBHOOK:DELETION] Found existing subscription, updating to cancelled:", existingSub.userId);
    // Update to cancelled status - no free plan is created
    // User will need to sign up for a new plan if they want to continue
    const { error: updateError } = await supabase
      .from("Subscription")
      .update({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .eq("stripeCustomerId", customerId);

    if (updateError) {
      console.error("[WEBHOOK:DELETION] Error updating subscription to cancelled:", updateError);
    } else {
      console.log("[WEBHOOK:DELETION] Subscription updated to cancelled successfully. User will need to sign up for a new plan.");
    }
  } else {
    console.log("[WEBHOOK:DELETION] No existing subscription found for customer:", customerId);
  }
}

async function handleInvoicePaymentSucceeded(
  supabase: ReturnType<typeof createServiceRoleClient>,
  invoice: Stripe.Invoice
) {
  // Payment succeeded - subscription should already be updated
  // This is just for logging or additional actions
  console.log("[WEBHOOK:INVOICE] Payment succeeded for invoice:", {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    subscriptionId: (invoice as any).subscription,
    amount: (invoice as any).amount_paid
  });
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createServiceRoleClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;
  console.log("[WEBHOOK:INVOICE] Payment failed for invoice:", {
    invoiceId: invoice.id,
    customerId,
    subscriptionId: (invoice as any).subscription
  });
  
  // Update subscription status to past_due
  const { error: updateError } = await supabase
    .from("Subscription")
    .update({
      status: "past_due",
      updatedAt: new Date(),
    })
    .eq("stripeCustomerId", customerId);

  if (updateError) {
    console.error("[WEBHOOK:INVOICE] Error updating subscription to past_due:", updateError);
  } else {
    console.log("[WEBHOOK:INVOICE] Subscription updated to past_due successfully");
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): "active" | "cancelled" | "past_due" | "trialing" {
  switch (status) {
    case "active":
      return "active";
    case "canceled":
    case "unpaid":
      return "cancelled";
    case "past_due":
      return "past_due";
    case "trialing":
      return "trialing";
    default:
      return "active";
  }
}

