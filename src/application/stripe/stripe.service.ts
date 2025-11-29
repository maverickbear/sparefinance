/**
 * Stripe Service
 * Business logic for Stripe integration
 * Orchestrates Stripe operations including checkout, subscriptions, and webhooks
 */

import { getStripeClient } from "@/src/infrastructure/external/stripe/stripe-client";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { CheckoutSessionResult, WebhookEventResult } from "../../domain/stripe/stripe.types";
import Stripe from "stripe";
import { logger } from "@/src/infrastructure/utils/logger";

export class StripeService {
  /**
   * Create a checkout session for trial (no authentication required)
   */
  async createTrialCheckoutSession(
    planId: string,
    interval: "month" | "year" = "month",
    returnUrl?: string,
    promoCode?: string
  ): Promise<CheckoutSessionResult> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();

      // Get plan
      const { data: plan, error: planError } = await supabase
        .from("Plan")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return { url: null, error: "Plan not found" };
      }

      const priceId = interval === "month" 
        ? plan.stripePriceIdMonthly 
        : plan.stripePriceIdYearly;

      if (!priceId) {
        return { url: null, error: "Stripe price ID not configured for this plan" };
      }

      // Get promo code if provided
      let stripeCouponId: string | undefined;
      if (promoCode) {
        const { data: promoCodeData } = await supabase
          .from("PromoCode")
          .select("stripeCouponId, isActive, expiresAt, planIds")
          .eq("code", promoCode.toUpperCase())
          .single();

        if (promoCodeData && promoCodeData.isActive) {
          if (promoCodeData.expiresAt && new Date(promoCodeData.expiresAt) < new Date()) {
            return { url: null, error: "Promo code has expired" };
          }

          const planIds = (promoCodeData.planIds || []) as string[];
          if (planIds.length > 0 && !planIds.includes(planId)) {
            return { url: null, error: "Promo code not valid for this plan" };
          }

          stripeCouponId = promoCodeData.stripeCouponId || undefined;
        } else {
          return { url: null, error: "Promo code not found" };
        }
      }

      // Create checkout session
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: 30,
          metadata: {
            planId: planId,
            interval: interval,
          },
        },
        payment_method_collection: "always",
        client_reference_id: `trial-${planId}-${Date.now()}`,
        success_url: returnUrl 
          ? `${baseUrl}${returnUrl}${returnUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`
          : `${baseUrl}subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}pricing?canceled=true`,
        metadata: {
          planId: planId,
          interval: interval,
          isTrial: "true",
        },
      };

      if (stripeCouponId) {
        sessionParams.discounts = [{ coupon: stripeCouponId }];
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return { url: session.url, error: null };
    } catch (error) {
      logger.error("[StripeService] Error creating trial checkout session:", error);
      return { 
        url: null, 
        error: error instanceof Error ? error.message : "Failed to create checkout session" 
      };
    }
  }

  /**
   * Create a checkout session for authenticated user
   */
  async createCheckoutSession(
    userId: string,
    planId: string,
    interval: "month" | "year" = "month",
    returnUrl?: string,
    promoCode?: string
  ): Promise<CheckoutSessionResult> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();

      // Get user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser || authUser.id !== userId) {
        return { url: null, error: "Unauthorized" };
      }

      // Get plan
      const { data: plan, error: planError } = await supabase
        .from("Plan")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return { url: null, error: "Plan not found" };
      }

      const priceId = interval === "month" 
        ? plan.stripePriceIdMonthly 
        : plan.stripePriceIdYearly;

      if (!priceId) {
        return { url: null, error: "Stripe price ID not configured for this plan" };
      }

      // Get or create Stripe customer
      let customerId: string;
      const { data: subscription } = await supabase
        .from("Subscription")
        .select("stripeCustomerId")
        .eq("userId", userId)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.stripeCustomerId) {
        customerId = subscription.stripeCustomerId;
      } else {
        // Get user data
        const { data: userData } = await supabase
          .from("User")
          .select("name, email")
          .eq("id", userId)
          .single();

        // Create Stripe customer
        const customer = await stripe.customers.create({
          email: userData?.email || authUser.email || undefined,
          name: userData?.name || undefined,
          metadata: {
            userId: userId,
          },
        });

        customerId = customer.id;
      }

      // Get promo code if provided
      let stripeCouponId: string | undefined;
      if (promoCode) {
        const { data: promoCodeData } = await supabase
          .from("PromoCode")
          .select("stripeCouponId, isActive, expiresAt, planIds")
          .eq("code", promoCode.toUpperCase())
          .single();

        if (promoCodeData && promoCodeData.isActive) {
          if (promoCodeData.expiresAt && new Date(promoCodeData.expiresAt) < new Date()) {
            return { url: null, error: "Promo code has expired" };
          }

          const planIds = (promoCodeData.planIds || []) as string[];
          if (planIds.length > 0 && !planIds.includes(planId)) {
            return { url: null, error: "Promo code not valid for this plan" };
          }

          stripeCouponId = promoCodeData.stripeCouponId || undefined;
        } else {
          return { url: null, error: "Promo code not found" };
        }
      }

      // Create checkout session
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          metadata: {
            userId: userId,
            planId: planId,
            interval: interval,
          },
        },
        success_url: returnUrl 
          ? `${baseUrl}${returnUrl}${returnUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`
          : `${baseUrl}subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}pricing?canceled=true`,
        metadata: {
          userId: userId,
          planId: planId,
          interval: interval,
        },
      };

      if (stripeCouponId) {
        sessionParams.discounts = [{ coupon: stripeCouponId }];
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return { url: session.url, error: null };
    } catch (error) {
      logger.error("[StripeService] Error creating checkout session:", error);
      return { 
        url: null, 
        error: error instanceof Error ? error.message : "Failed to create checkout session" 
      };
    }
  }

  /**
   * Create a customer portal session
   */
  async createPortalSession(userId: string): Promise<CheckoutSessionResult> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();

      // Get user's Stripe customer ID
      const { data: subscription } = await supabase
        .from("Subscription")
        .select("stripeCustomerId")
        .eq("userId", userId)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscription?.stripeCustomerId) {
        return { url: null, error: "No Stripe customer found" };
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${baseUrl}subscription`,
      });

      return { url: session.url, error: null };
    } catch (error) {
      logger.error("[StripeService] Error creating portal session:", error);
      return { 
        url: null, 
        error: error instanceof Error ? error.message : "Failed to create portal session" 
      };
    }
  }

  /**
   * Handle webhook event
   * Note: This is a simplified version. The full implementation should handle
   * all webhook event types (checkout.session.completed, subscription.updated, etc.)
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<WebhookEventResult> {
    try {
      // This is a placeholder. The full implementation should:
      // 1. Handle checkout.session.completed
      // 2. Handle subscription.created/updated/deleted
      // 3. Handle invoice.payment_succeeded/failed
      // 4. Update database accordingly
      
      logger.info("[StripeService] Webhook event received:", { type: event.type, id: event.id });
      
      // Return success for now - full implementation should be added
      return { success: true };
    } catch (error) {
      logger.error("[StripeService] Error handling webhook event:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to handle webhook event" 
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string
  ): Stripe.Event {
    const stripe = getStripeClient();
    return stripe.webhooks.constructEvent(body, signature, secret);
  }
}

