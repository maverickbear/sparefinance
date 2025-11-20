"use server";

import Stripe from "stripe";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase-server";
import { PlanFeatures } from "@/lib/validations/plan";

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

/**
 * Create a checkout session for trial (no authentication required)
 * This allows users to start a trial before creating an account
 */
export async function createTrialCheckoutSession(
  planId: string,
  interval: "month" | "year" = "month",
  returnUrl?: string,
  promoCode?: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    console.log("[TRIAL-CHECKOUT] Starting trial checkout session creation:", { planId, interval });
    const supabase = await createServerClient();
    
    // Get plan
    const { data: plan, error: planError } = await supabase
      .from("Plan")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("[TRIAL-CHECKOUT] Plan not found:", { planId, planError });
      return { url: null, error: "Plan not found" };
    }
    console.log("[TRIAL-CHECKOUT] Plan found:", { planId: plan.id, name: plan.name });

    const priceId = interval === "month" 
      ? plan.stripePriceIdMonthly 
      : plan.stripePriceIdYearly;

    if (!priceId) {
      console.error("[TRIAL-CHECKOUT] Stripe price ID not configured:", { planId, interval });
      return { url: null, error: "Stripe price ID not configured for this plan" };
    }
    console.log("[TRIAL-CHECKOUT] Using price ID:", { priceId, interval });

    // Get promo code if provided
    let stripeCouponId: string | undefined;
    if (promoCode) {
      console.log("[TRIAL-CHECKOUT] Looking up promo code:", promoCode);
      const { data: promoCodeData, error: promoError } = await supabase
        .from("PromoCode")
        .select("stripeCouponId, isActive, expiresAt, planIds")
        .eq("code", promoCode.toUpperCase())
        .single();

      if (!promoError && promoCodeData) {
        // Check if promo code is active
        if (!promoCodeData.isActive) {
          console.log("[TRIAL-CHECKOUT] Promo code is not active:", promoCode);
          return { url: null, error: "Promo code is not active" };
        }

        // Check if expired
        if (promoCodeData.expiresAt && new Date(promoCodeData.expiresAt) < new Date()) {
          console.log("[TRIAL-CHECKOUT] Promo code has expired:", promoCode);
          return { url: null, error: "Promo code has expired" };
        }

        // Check if plan is allowed (if planIds is specified)
        const planIds = (promoCodeData.planIds || []) as string[];
        if (planIds.length > 0 && !planIds.includes(planId)) {
          console.log("[TRIAL-CHECKOUT] Promo code not valid for this plan:", { promoCode, planId });
          return { url: null, error: "Promo code not valid for this plan" };
        }

        stripeCouponId = promoCodeData.stripeCouponId || undefined;
        console.log("[TRIAL-CHECKOUT] Promo code found:", { promoCode, stripeCouponId });
      } else {
        console.log("[TRIAL-CHECKOUT] Promo code not found:", promoCode);
        return { url: null, error: "Promo code not found" };
      }
    }

    // Create checkout session with trial period
    // No customer ID needed - Stripe will create one from email entered in checkout
    // Note: Stripe requires a payment method for subscriptions, but won't charge during trial
    // Use client_reference_id to link session to user when they sign up later
    console.log("[TRIAL-CHECKOUT] Creating Stripe checkout session with trial:", { priceId, planId, promoCode, stripeCouponId });
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          planId: planId,
          interval: interval,
        },
      },
      // Payment method is required but won't be charged during trial
      // User can add payment method in checkout, and it will only be charged after trial ends
      payment_method_collection: "always",
      // client_reference_id will be available in checkout.session.completed webhook
      // We can use it to link the subscription when user signs up
      // Using planId as part of reference for easier tracking
      client_reference_id: `trial-${planId}-${Date.now()}`,
      success_url: returnUrl 
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`
        : `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/"}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl 
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}canceled=true`
        : `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/"}/pricing?canceled=true`,
      metadata: {
        planId: planId,
        interval: interval,
        isTrial: "true",
      },
    };

    // Add discount if promo code is provided
    if (stripeCouponId) {
      sessionParams.discounts = [{ coupon: stripeCouponId }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("[TRIAL-CHECKOUT] Checkout session created successfully:", { 
      sessionId: session.id, 
      url: session.url,
      subscriptionId: session.subscription,
    });

    return { url: session.url, error: null };
  } catch (error) {
    console.error("[TRIAL-CHECKOUT] Error creating checkout session:", error);
    return { 
      url: null, 
      error: error instanceof Error ? error.message : "Failed to create checkout session" 
    };
  }
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

    // Get user name from User table
    const { data: userData } = await supabase
      .from("User")
      .select("name")
      .eq("id", userId)
      .single();

    if (subscription?.stripeCustomerId) {
      customerId = subscription.stripeCustomerId;
      console.log("[CHECKOUT] Using existing Stripe customer:", customerId);
      
      // Update existing customer with current email and name
      try {
        await stripe.customers.update(customerId, {
          email: authUser.email!,
          name: userData?.name || undefined,
          metadata: {
            userId: userId,
          },
        });
        console.log("[CHECKOUT] Updated existing Stripe customer with email and name:", { 
          customerId, 
          email: authUser.email, 
          name: userData?.name 
        });
      } catch (updateError) {
        console.error("[CHECKOUT] Error updating existing Stripe customer:", updateError);
        // Continue anyway - customer exists, just couldn't update
      }
    } else {
      // Create Stripe customer
      console.log("[CHECKOUT] Creating new Stripe customer for user:", userId);
      const customer = await stripe.customers.create({
        email: authUser.email!,
        name: userData?.name || undefined,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;
      console.log("[CHECKOUT] Stripe customer created:", { customerId, email: authUser.email, name: userData?.name });

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
      success_url: returnUrl 
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`
        : `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/"}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl 
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}canceled=true`
        : `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/"}/pricing?canceled=true`,
      metadata: {
        userId: userId,
        planId: planId,
        interval: interval,
      },
      // client_reference_id helps link checkout session to user
      // Useful for tracking and webhook processing
      client_reference_id: userId,
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
    // Return URL includes a parameter to trigger subscription sync
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/"}/settings?tab=billing&portal_return=true`;
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
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
    // Note: This function is called AFTER we've already returned a 2xx response
    // to Stripe, so we can do complex processing here without timeout concerns
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
    metadata: session.metadata,
    clientReferenceId: session.client_reference_id
  });
  
  // If we have a userId in metadata or client_reference_id, update customer metadata
  const userId = session.metadata?.userId || (session.client_reference_id?.startsWith('trial-') ? null : session.client_reference_id);
  if (userId && session.customer && typeof session.customer === 'string') {
    try {
      await stripe.customers.update(session.customer, {
        metadata: {
          userId: userId,
          ...(session.metadata || {}),
        },
      });
      console.log("[WEBHOOK:CHECKOUT] Updated customer metadata with userId:", userId);
    } catch (error) {
      console.error("[WEBHOOK:CHECKOUT] Error updating customer metadata:", error);
    }
  }
  
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
      await handleSubscriptionChange(supabase, subscription, session);
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
  subscription: Stripe.Subscription,
  checkoutSession?: Stripe.Checkout.Session
) {
  const customerId = subscription.customer as string;
  console.log("[WEBHOOK:SUBSCRIPTION] Processing subscription change:", {
    subscriptionId: subscription.id,
    customerId,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price.id
  });
  
  // First, try to get userId from checkout session (most reliable when available)
  let userId: string | null = null;
  if (checkoutSession) {
    const sessionUserId = checkoutSession.metadata?.userId || 
                         (checkoutSession.client_reference_id?.startsWith('trial-') ? null : checkoutSession.client_reference_id);
    if (sessionUserId) {
      userId = sessionUserId;
      console.log("[WEBHOOK:SUBSCRIPTION] Found userId from checkout session:", userId);
    }
  }
  
  // If not found in checkout session, try to find user by existing subscription with stripeSubscriptionId
  if (!userId) {
    console.log("[WEBHOOK:SUBSCRIPTION] Looking for existing subscription with stripeSubscriptionId:", subscription.id);
  const { data: existingSubByStripeId, error: existingSubByStripeIdError } = await supabase
    .from("Subscription")
    .select("userId")
    .eq("stripeSubscriptionId", subscription.id)
    .limit(1)
    .maybeSingle();

  if (existingSubByStripeIdError) {
    console.error("[WEBHOOK:SUBSCRIPTION] Error fetching subscription by stripeSubscriptionId:", existingSubByStripeIdError);
  }

    if (existingSubByStripeId) {
      userId = existingSubByStripeId.userId;
      console.log("[WEBHOOK:SUBSCRIPTION] Found userId from existing subscription (by stripeSubscriptionId):", userId);
    }
  }
  
  // If still not found, try to find by customer ID
  if (!userId) {
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
      console.log("[WEBHOOK:SUBSCRIPTION] Found userId from existing subscription (by customerId):", userId);
    }
  }
  
  // If still not found, try to get userId from Stripe customer metadata
  if (!userId) {
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
        // User hasn't signed up yet - create pending subscription
        // The subscription will be linked automatically when they sign up with matching email
        console.log("[WEBHOOK:SUBSCRIPTION] ⚠️ No userId found for customer - will create pending subscription");
        console.log("[WEBHOOK:SUBSCRIPTION] Customer ID:", customerId);
        
        // Get customer email for pending subscription
        let customerEmail: string | null = null;
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && typeof customer !== "string" && !customer.deleted && customer.email) {
            customerEmail = customer.email;
            console.log("[WEBHOOK:SUBSCRIPTION] Customer email found for pending subscription:", customerEmail);
          }
        } catch (error) {
          console.error("[WEBHOOK:SUBSCRIPTION] Error retrieving customer:", error);
        }

        if (!customerEmail) {
          console.log("[WEBHOOK:SUBSCRIPTION] No customer email found - cannot create pending subscription");
          return;
        }

        // Get plan from price ID
        const priceId = subscription.items.data[0]?.price.id;
        if (!priceId) {
          console.error("[WEBHOOK:SUBSCRIPTION] No price ID in subscription");
          return;
        }

        // Find plan by price ID (need name for email)
        const { data: plan, error: planError } = await supabase
          .from("Plan")
          .select("id, name")
          .or(`stripePriceIdMonthly.eq.${priceId},stripePriceIdYearly.eq.${priceId}`)
          .single();

        if (planError || !plan) {
          console.error("[WEBHOOK:SUBSCRIPTION] No plan found for price ID:", { priceId, planError });
          return;
        }

        // Create pending subscription ID using customerId (temporary, will be updated when user signs up)
        const pendingSubscriptionId = `pending-${customerId}-${plan.id}`;
        const status = mapStripeStatus(subscription.status);

        // Check if pending subscription already exists
        const { data: existingPendingSub } = await supabase
          .from("Subscription")
          .select("id")
          .eq("stripeCustomerId", customerId)
          .is("userId", null)
          .maybeSingle();

        const subscriptionData: any = {
          id: existingPendingSub?.id || pendingSubscriptionId,
          userId: null, // NULL for pending subscriptions
          planId: plan.id,
          status: status,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customerId,
          pendingEmail: customerEmail.toLowerCase(),
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
          trialStartDate: (subscription as any).trial_start ? new Date((subscription as any).trial_start * 1000) : null,
          trialEndDate: (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000) : null,
          updatedAt: new Date(),
        };

        // Upsert pending subscription
        // If exists, update by id; otherwise insert new
        let shouldSendEmail = false;
        
        if (existingPendingSub) {
          const { error: updateError } = await supabase
            .from("Subscription")
            .update(subscriptionData)
            .eq("id", existingPendingSub.id);
          
          if (updateError) {
            console.error("[WEBHOOK:SUBSCRIPTION] Error updating pending subscription:", updateError);
          } else {
            console.log("[WEBHOOK:SUBSCRIPTION] Pending subscription updated successfully:", {
              subscriptionId: subscriptionData.id,
              email: customerEmail,
              status,
              trialEndDate: subscriptionData.trialEndDate,
            });
            // Only send email on first creation, not on updates
            shouldSendEmail = false;
          }
        } else {
          const { error: insertError } = await supabase
            .from("Subscription")
            .insert(subscriptionData);
          
          if (insertError) {
            console.error("[WEBHOOK:SUBSCRIPTION] Error creating pending subscription:", insertError);
          } else {
            console.log("[WEBHOOK:SUBSCRIPTION] Pending subscription created successfully:", {
              subscriptionId: subscriptionData.id,
              email: customerEmail,
              status,
              trialEndDate: subscriptionData.trialEndDate,
            });
            console.log("[WEBHOOK:SUBSCRIPTION] Subscription will be automatically linked when user signs up with email:", customerEmail);
            shouldSendEmail = true;
          }
        }
        
        // Send email to user with signup link (only on creation)
        if (shouldSendEmail) {
          console.log("[WEBHOOK:SUBSCRIPTION] Preparing to send checkout pending email to:", customerEmail);
          try {
            const { sendCheckoutPendingEmail } = await import("@/lib/utils/email");
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com";
            console.log("[WEBHOOK:SUBSCRIPTION] App URL:", appUrl);
            
            // Try to get checkout session ID from subscription metadata or find latest session for customer
            let sessionId: string | null = null;
            if (checkoutSession?.id) {
              sessionId = checkoutSession.id;
              console.log("[WEBHOOK:SUBSCRIPTION] Using checkout session from parameter:", sessionId);
            } else {
              // Try to find the latest checkout session for this customer
              console.log("[WEBHOOK:SUBSCRIPTION] No checkout session in parameter, searching for customer sessions...");
              try {
                const sessions = await stripe.checkout.sessions.list({
                  customer: customerId,
                  limit: 1,
                });
                if (sessions.data.length > 0) {
                  sessionId = sessions.data[0].id;
                  console.log("[WEBHOOK:SUBSCRIPTION] Found checkout session:", sessionId);
                } else {
                  console.log("[WEBHOOK:SUBSCRIPTION] No checkout sessions found for customer");
                }
              } catch (error) {
                console.error("[WEBHOOK:SUBSCRIPTION] Error fetching checkout session:", error);
              }
            }
            
            const signupUrl = sessionId 
              ? `${appUrl}/subscription/success?session_id=${sessionId}`
              : `${appUrl}/auth/signup`;
            
            console.log("[WEBHOOK:SUBSCRIPTION] Signup URL:", signupUrl);
            console.log("[WEBHOOK:SUBSCRIPTION] Plan name:", plan.name || plan.id);
            console.log("[WEBHOOK:SUBSCRIPTION] Trial end date:", subscriptionData.trialEndDate);
            
            await sendCheckoutPendingEmail({
              to: customerEmail,
              planName: plan.name || plan.id,
              trialEndDate: subscriptionData.trialEndDate,
              signupUrl: signupUrl,
              appUrl: appUrl,
            });
            
            console.log("[WEBHOOK:SUBSCRIPTION] ✅ Checkout pending email sent successfully to:", customerEmail);
            
            // Send welcome email from founder
            try {
              const { sendWelcomeEmail } = await import("@/lib/utils/email");
              
              await sendWelcomeEmail({
                to: customerEmail,
                userName: "", // Not used anymore, but keeping for interface compatibility
                founderName: "Naor Tartarotti",
                appUrl: appUrl,
              });
              
              console.log("[WEBHOOK:SUBSCRIPTION] ✅ Welcome email sent successfully to:", customerEmail);
            } catch (welcomeEmailError) {
              console.error("[WEBHOOK:SUBSCRIPTION] ❌ Error sending welcome email:", welcomeEmailError);
              // Don't fail the webhook if welcome email fails
            }
          } catch (emailError) {
            console.error("[WEBHOOK:SUBSCRIPTION] ❌ Error sending checkout pending email:", emailError);
            if (emailError instanceof Error) {
              console.error("[WEBHOOK:SUBSCRIPTION] Error message:", emailError.message);
              console.error("[WEBHOOK:SUBSCRIPTION] Error stack:", emailError.stack);
            }
            // Don't fail the webhook if email fails
          }
        } else {
          console.log("[WEBHOOK:SUBSCRIPTION] Skipping email send (subscription already exists)");
        }

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

  // Get existing subscription to preserve trial dates if they exist
  const { data: existingSubData } = await supabase
    .from("Subscription")
    .select("trialStartDate, trialEndDate, status")
    .eq("id", subscriptionId)
    .maybeSingle();

  // Get active household ID for the user (if user exists)
  let householdId: string | null = null;
  if (userId) {
    try {
      // Try to get from UserActiveHousehold first
      const { data: activeHousehold } = await supabase
        .from("UserActiveHousehold")
        .select("householdId")
        .eq("userId", userId)
        .maybeSingle();
      
      if (activeHousehold?.householdId) {
        householdId = activeHousehold.householdId;
      } else {
        // Fallback to default (personal) household
        const { data: defaultMember } = await supabase
          .from("HouseholdMemberNew")
          .select("householdId")
          .eq("userId", userId)
          .eq("isDefault", true)
          .eq("status", "active")
          .maybeSingle();
        
        if (defaultMember?.householdId) {
          householdId = defaultMember.householdId;
        }
      }
      
      if (householdId) {
        console.log("[WEBHOOK:SUBSCRIPTION] Found householdId for user:", { userId, householdId });
      } else {
        console.log("[WEBHOOK:SUBSCRIPTION] No householdId found for user (will be null):", userId);
      }
    } catch (error) {
      console.error("[WEBHOOK:SUBSCRIPTION] Error getting householdId:", error);
      // Continue without householdId - it can be set later
    }
  }

  // Prepare subscription data
  const subscriptionData: any = {
    id: subscriptionId,
    userId: userId,
    householdId: householdId, // Link to active household (null if not found)
    planId: plan.id,
    status: status,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    updatedAt: new Date(),
  };

  // Preserve trial start date if it exists, or set from Stripe if available
  if (existingSubData?.trialStartDate) {
    subscriptionData.trialStartDate = existingSubData.trialStartDate;
  } else if ((subscription as any).trial_start) {
    subscriptionData.trialStartDate = new Date((subscription as any).trial_start * 1000);
  }

  // If subscription status is changing to "active" (payment was made), finalize trial immediately
  const wasTrialing = existingSubData?.status === "trialing";
  const isNowActive = status === "active";
  const hasTrialEndDate = existingSubData?.trialEndDate || (subscription as any).trial_end;

  if (isNowActive && wasTrialing && hasTrialEndDate) {
    // Payment was made during trial - finalize trial immediately by setting trialEndDate to now
    const now = new Date();
    subscriptionData.trialEndDate = now;
    console.log("[WEBHOOK:SUBSCRIPTION] Payment made during trial - finalizing trial immediately:", {
      subscriptionId,
      previousStatus: existingSubData?.status,
      newStatus: status,
      previousTrialEndDate: existingSubData?.trialEndDate,
      newTrialEndDate: now,
    });
  } else {
    // Preserve trial end date if it exists, or set from Stripe if available
    if (existingSubData?.trialEndDate) {
      subscriptionData.trialEndDate = existingSubData.trialEndDate;
    } else if ((subscription as any).trial_end) {
      subscriptionData.trialEndDate = new Date((subscription as any).trial_end * 1000);
    }
  }

  // Upsert the subscription
  console.log("[WEBHOOK:SUBSCRIPTION] Upserting subscription to database...");
  const { data: upsertedSub, error: upsertError } = await supabase
    .from("Subscription")
    .upsert(subscriptionData, {
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

  // Invalidate subscription cache to ensure UI reflects changes immediately
  if (userId) {
    const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
    await invalidateSubscriptionCache(userId);
    console.log("[WEBHOOK:SUBSCRIPTION] Subscription cache invalidated for user:", userId);
  }
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
      
      // Invalidate subscription cache to ensure UI reflects cancellation immediately
      const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
      await invalidateSubscriptionCache(existingSub.userId);
      console.log("[WEBHOOK:DELETION] Subscription cache invalidated for user:", existingSub.userId);
    }
  } else {
    console.log("[WEBHOOK:DELETION] No existing subscription found for customer:", customerId);
  }
}

async function handleInvoicePaymentSucceeded(
  supabase: ReturnType<typeof createServiceRoleClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;
  const subscriptionId = (invoice as any).subscription as string | null;
  
  console.log("[WEBHOOK:INVOICE] Payment succeeded for invoice:", {
    invoiceId: invoice.id,
    customerId,
    subscriptionId,
    amount: (invoice as any).amount_paid
  });

  // If payment was made, finalize any active trial immediately
  if (subscriptionId) {
    try {
      // Find subscription by Stripe subscription ID
      const { data: subscription, error: subError } = await supabase
        .from("Subscription")
        .select("id, status, trialEndDate")
        .eq("stripeSubscriptionId", subscriptionId)
        .maybeSingle();

      if (subError) {
        console.error("[WEBHOOK:INVOICE] Error fetching subscription:", subError);
      }

      // If subscription exists and is in trialing status, finalize trial
      if (subscription && subscription.status === "trialing" && subscription.trialEndDate) {
        const now = new Date();
        const { error: updateError } = await supabase
          .from("Subscription")
          .update({
            trialEndDate: now,
            updatedAt: now,
          })
          .eq("id", subscription.id);

        if (updateError) {
          console.error("[WEBHOOK:INVOICE] Error finalizing trial:", updateError);
        } else {
          console.log("[WEBHOOK:INVOICE] Trial finalized immediately after payment:", {
            subscriptionId: subscription.id,
            previousTrialEndDate: subscription.trialEndDate,
            newTrialEndDate: now,
          });

          // Invalidate cache
          const { data: subData } = await supabase
            .from("Subscription")
            .select("userId")
            .eq("id", subscription.id)
            .single();

          if (subData?.userId) {
            const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
            await invalidateSubscriptionCache(subData.userId);
            console.log("[WEBHOOK:INVOICE] Subscription cache invalidated for user:", subData.userId);
          }
        }
      }
    } catch (error) {
      console.error("[WEBHOOK:INVOICE] Error processing payment succeeded:", error);
    }
  }
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
    case "incomplete":
    case "incomplete_expired":
      // Incomplete subscriptions (no payment method) should be treated as trialing
      // until payment method is added, then they become active
      // If incomplete_expired, treat as cancelled
      return status === "incomplete_expired" ? "cancelled" : "trialing";
    default:
      return "active";
  }
}

/**
 * Feature definitions mapping our plan features to Stripe Features
 */
const FEATURE_DEFINITIONS = [
  { lookupKey: "investments", name: "Investments", description: "Investment tracking and portfolio management" },
  { lookupKey: "household", name: "Household Members", description: "Add and manage household members" },
  { lookupKey: "advanced_reports", name: "Advanced Reports", description: "Access to advanced financial reports" },
  { lookupKey: "csv_export", name: "CSV Export", description: "Export data to CSV format" },
  { lookupKey: "csv_import", name: "CSV Import", description: "Import data from CSV files" },
  { lookupKey: "debts", name: "Debt Tracking", description: "Track and manage debts" },
  { lookupKey: "goals", name: "Goals", description: "Set and track financial goals" },
  { lookupKey: "bank_integration", name: "Bank Integration", description: "Connect bank accounts via Plaid" },
] as const;

/**
 * Create or update a Stripe Feature
 */
async function ensureStripeFeature(
  lookupKey: string,
  name: string,
  description: string
): Promise<string> {
  try {
    // Try to find existing feature
    const existingFeatures = await stripe.entitlements.features.list({
      lookup_key: lookupKey,
      limit: 1,
    });

    if (existingFeatures.data.length > 0) {
      // Update existing feature
      const feature = await stripe.entitlements.features.update(
        existingFeatures.data[0].id,
        {
          name,
          metadata: {
            description,
          },
        }
      );
      return feature.id;
    } else {
      // Create new feature
      const feature = await stripe.entitlements.features.create({
        lookup_key: lookupKey,
        name,
        metadata: {
          description,
        },
      });
      return feature.id;
    }
  } catch (error) {
    console.error(`Error ensuring feature ${lookupKey}:`, error);
    throw error;
  }
}

/**
 * Get all features associated with a product
 */
async function getProductFeatures(productId: string): Promise<string[]> {
  try {
    const product = await stripe.products.retrieve(productId);
    // Features are stored in product.default_price or we need to check entitlements
    // For now, we'll use the product's metadata or check entitlements
    const features: string[] = [];
    
    // List all entitlements for this product to get associated features
    // Note: This requires checking subscriptions or using a different approach
    // For simplicity, we'll manage features through product metadata for now
    return features;
  } catch (error) {
    console.error(`Error getting product features for ${productId}:`, error);
    return [];
  }
}

/**
 * Sync plan features to Stripe using Features API
 * This creates/updates Stripe Features and associates them with products
 */
export async function syncPlanFeaturesToStripe(planId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    
    // Get plan from database
    const { data: plan, error: planError } = await supabase
      .from("Plan")
      .select("id, name, features, stripeProductId")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return { success: false, error: `Plan ${planId} not found` };
    }

    if (!plan.stripeProductId) {
      return { success: false, error: `Plan ${planId} has no Stripe Product ID configured` };
    }

    // Map our features to Stripe Features
    const featureMap: Record<string, boolean> = {
      investments: plan.features.hasInvestments,
      household: plan.features.hasHousehold,
      advanced_reports: plan.features.hasAdvancedReports,
      csv_export: plan.features.hasCsvExport,
      csv_import: plan.features.hasCsvImport,
      debts: plan.features.hasDebts,
      goals: plan.features.hasGoals,
      bank_integration: plan.features.hasBankIntegration,
    };

    // Create/update all features in Stripe
    const featureIds: string[] = [];
    for (const featureDef of FEATURE_DEFINITIONS) {
      if (featureMap[featureDef.lookupKey]) {
        try {
          const featureId = await ensureStripeFeature(
            featureDef.lookupKey,
            featureDef.name,
            featureDef.description
          );
          featureIds.push(featureId);
          console.log(`✅ Feature ${featureDef.lookupKey} ensured: ${featureId}`);
        } catch (error) {
          console.error(`❌ Error ensuring feature ${featureDef.lookupKey}:`, error);
        }
      }
    }

    // Update product with features metadata for reference
    // Note: Stripe Features are associated through entitlements when subscriptions are created
    // For now, we'll also store in product metadata for easy reference
    const metadata: Record<string, string> = {
      planId: plan.id,
      planName: plan.name,
      // Individual feature flags
      hasInvestments: String(plan.features.hasInvestments),
      hasAdvancedReports: String(plan.features.hasAdvancedReports),
      hasCsvExport: String(plan.features.hasCsvExport),
      hasCsvImport: String(plan.features.hasCsvImport),
      hasDebts: String(plan.features.hasDebts),
      hasGoals: String(plan.features.hasGoals),
      hasBankIntegration: String(plan.features.hasBankIntegration),
      hasHousehold: String(plan.features.hasHousehold),
      // Limits
      maxTransactions: String(plan.features.maxTransactions),
      maxAccounts: String(plan.features.maxAccounts),
      // Feature IDs (comma-separated)
      featureIds: featureIds.join(","),
      // Full features JSON (for reference)
      features: JSON.stringify(plan.features),
    };

    await stripe.products.update(plan.stripeProductId, {
      metadata,
    });

    return { success: true };
  } catch (error) {
    console.error("Error syncing plan features to Stripe:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync complete plan to Stripe (features, prices, product name)
 * This is a comprehensive sync that updates everything in Stripe
 */
export async function syncPlanToStripe(planId: string): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  const warnings: string[] = [];
  
  try {
    const supabase = await createServerClient();
    
    // Get plan from database
    const { data: plan, error: planError } = await supabase
      .from("Plan")
      .select("id, name, priceMonthly, priceYearly, features, stripeProductId, stripePriceIdMonthly, stripePriceIdYearly")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return { success: false, error: `Plan ${planId} not found` };
    }

    if (!plan.stripeProductId) {
      return { success: false, error: `Plan ${planId} has no Stripe Product ID configured` };
    }

    // 1. Update product name
    try {
      await stripe.products.update(plan.stripeProductId, {
        name: plan.name,
      });
      console.log(`✅ Updated product name: ${plan.name}`);
    } catch (error) {
      warnings.push(`Failed to update product name: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    // 2. Update or create prices
    const currency = "cad"; // Assuming CAD currency
    
    // Update monthly price (only if price changed or doesn't exist)
    if (plan.stripePriceIdMonthly) {
      try {
        // Check current price in Stripe
        const currentPrice = await stripe.prices.retrieve(plan.stripePriceIdMonthly);
        const currentAmount = currentPrice.unit_amount || 0;
        const newAmount = Math.round(plan.priceMonthly * 100);
        
        // Only create new price if amount changed
        if (currentAmount !== newAmount) {
          const newMonthlyPrice = await stripe.prices.create({
            product: plan.stripeProductId,
            unit_amount: newAmount,
            currency: currency,
            recurring: {
              interval: "month",
            },
          });
          
          // Archive old price
          await stripe.prices.update(plan.stripePriceIdMonthly, {
            active: false,
          });
          
          // Update plan with new price ID
          await supabase
            .from("Plan")
            .update({ stripePriceIdMonthly: newMonthlyPrice.id })
            .eq("id", planId);
          
          console.log(`✅ Updated monthly price: ${newMonthlyPrice.id} (old: ${currentAmount}, new: ${newAmount})`);
        } else {
          console.log(`✅ Monthly price unchanged: ${currentAmount}`);
        }
      } catch (error) {
        warnings.push(`Failed to update monthly price: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } else {
      // Create new monthly price if it doesn't exist
      try {
        const newMonthlyPrice = await stripe.prices.create({
          product: plan.stripeProductId,
          unit_amount: Math.round(plan.priceMonthly * 100),
          currency: currency,
          recurring: {
            interval: "month",
          },
        });
        
        await supabase
          .from("Plan")
          .update({ stripePriceIdMonthly: newMonthlyPrice.id })
          .eq("id", planId);
        
        console.log(`✅ Created monthly price: ${newMonthlyPrice.id}`);
      } catch (error) {
        warnings.push(`Failed to create monthly price: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Update yearly price (only if price changed or doesn't exist)
    if (plan.stripePriceIdYearly) {
      try {
        // Check current price in Stripe
        const currentPrice = await stripe.prices.retrieve(plan.stripePriceIdYearly);
        const currentAmount = currentPrice.unit_amount || 0;
        const newAmount = Math.round(plan.priceYearly * 100);
        
        // Only create new price if amount changed
        if (currentAmount !== newAmount) {
          const newYearlyPrice = await stripe.prices.create({
            product: plan.stripeProductId,
            unit_amount: newAmount,
            currency: currency,
            recurring: {
              interval: "year",
            },
          });
          
          // Archive old price
          await stripe.prices.update(plan.stripePriceIdYearly, {
            active: false,
          });
          
          // Update plan with new price ID
          await supabase
            .from("Plan")
            .update({ stripePriceIdYearly: newYearlyPrice.id })
            .eq("id", planId);
          
          console.log(`✅ Updated yearly price: ${newYearlyPrice.id} (old: ${currentAmount}, new: ${newAmount})`);
        } else {
          console.log(`✅ Yearly price unchanged: ${currentAmount}`);
        }
      } catch (error) {
        warnings.push(`Failed to update yearly price: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } else {
      // Create new yearly price if it doesn't exist
      try {
        const newYearlyPrice = await stripe.prices.create({
          product: plan.stripeProductId,
          unit_amount: Math.round(plan.priceYearly * 100),
          currency: currency,
          recurring: {
            interval: "year",
          },
        });
        
        await supabase
          .from("Plan")
          .update({ stripePriceIdYearly: newYearlyPrice.id })
          .eq("id", planId);
        
        console.log(`✅ Created yearly price: ${newYearlyPrice.id}`);
      } catch (error) {
        warnings.push(`Failed to create yearly price: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // 3. Sync features
    const featuresResult = await syncPlanFeaturesToStripe(planId);
    if (!featuresResult.success) {
      warnings.push(`Failed to sync features: ${featuresResult.error || "Unknown error"}`);
    }

    return { 
      success: warnings.length === 0, 
      error: warnings.length > 0 ? warnings.join("; ") : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error("Error syncing plan to Stripe:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      warnings,
    };
  }
}

