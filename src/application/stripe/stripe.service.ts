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
import { WebhookEventsRepository } from "@/src/infrastructure/database/repositories/webhook-events.repository";
import { SubscriptionsRepository } from "@/src/infrastructure/database/repositories/subscriptions.repository";
import { AppError } from "../shared/app-error";
import { getActiveHouseholdId } from "@/lib/utils/household";

export class StripeService {
  constructor(
    private webhookEventsRepository: WebhookEventsRepository = new WebhookEventsRepository(),
    private subscriptionsRepository: SubscriptionsRepository = new SubscriptionsRepository()
  ) {}
  /**
   * Create a checkout session for trial (no authentication required)
   * NOTE: This method requires payment method collection. For trial without card,
   * use /api/billing/start-trial instead which creates subscription directly.
   * This method is kept for backward compatibility but should not be used for new trial flows.
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
        .from("app_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return { url: null, error: "Plan not found" };
      }

      const priceId = interval === "month" 
        ? plan.stripe_price_id_monthly 
        : plan.stripe_price_id_yearly;

      if (!priceId) {
        return { url: null, error: "Stripe price ID not configured for this plan" };
      }

      // Get promo code if provided
      let stripeCouponId: string | undefined;
      if (promoCode) {
        const { data: promoCodeData } = await supabase
          .from("system_promo_codes")
          .select("stripe_coupon_id, is_active, expires_at, plan_ids")
          .eq("code", promoCode.toUpperCase())
          .single();

        if (promoCodeData && promoCodeData.is_active) {
          if (promoCodeData.expires_at && new Date(promoCodeData.expires_at) < new Date()) {
            return { url: null, error: "Promo code has expired" };
          }

          const planIds = (promoCodeData.plan_ids || []) as string[];
          if (planIds.length > 0 && !planIds.includes(planId)) {
            return { url: null, error: "Promo code not valid for this plan" };
          }

          stripeCouponId = promoCodeData.stripe_coupon_id || undefined;
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
        cancel_url: `${baseUrl}dashboard?openPricingModal=true&canceled=true`,
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
        .from("app_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return { url: null, error: "Plan not found" };
      }

      const priceId = interval === "month" 
        ? plan.stripe_price_id_monthly 
        : plan.stripe_price_id_yearly;

      if (!priceId) {
        return { url: null, error: "Stripe price ID not configured for this plan" };
      }

      // Get or create Stripe customer
      let customerId: string;
      const { data: subscription } = await supabase
        .from("app_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.stripe_customer_id) {
        customerId = subscription.stripe_customer_id;
      } else {
        // Get user data
        const { data: userData } = await supabase
          .from("users")
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
          .from("system_promo_codes")
          .select("stripe_coupon_id, is_active, expires_at, plan_ids")
          .eq("code", promoCode.toUpperCase())
          .single();

        if (promoCodeData && promoCodeData.is_active) {
          if (promoCodeData.expires_at && new Date(promoCodeData.expires_at) < new Date()) {
            return { url: null, error: "Promo code has expired" };
          }

          const planIds = (promoCodeData.plan_ids || []) as string[];
          if (planIds.length > 0 && !planIds.includes(planId)) {
            return { url: null, error: "Promo code not valid for this plan" };
          }

          stripeCouponId = promoCodeData.stripe_coupon_id || undefined;
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
        cancel_url: `${baseUrl}dashboard?openPricingModal=true&canceled=true`,
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
        .from("app_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscription?.stripe_customer_id) {
        return { url: null, error: "No Stripe customer found" };
      }

      // Build return URL - ensure baseUrl ends with / and use correct path
      let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com";
      // Remove trailing slash if present, then add it back to ensure consistency
      baseUrl = baseUrl.replace(/\/+$/, '');
      const returnUrl = `${baseUrl}/settings/billing?portal_return=true`;
      
      // Validate URL format
      try {
        new URL(returnUrl);
      } catch (error) {
        logger.error("[StripeService] Invalid return URL constructed:", { baseUrl, returnUrl });
        return { 
          url: null, 
          error: `Invalid return URL: ${returnUrl}. Please check NEXT_PUBLIC_APP_URL environment variable.` 
        };
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: returnUrl,
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
   * Handle webhook event with idempotency
   * Prevents duplicate processing of the same webhook event
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<WebhookEventResult> {
    try {
      logger.info("[StripeService] Webhook event received:", { type: event.type, id: event.id });

      // Check if event was already processed (idempotency)
      const existingEvent = await this.webhookEventsRepository.findByEventId(event.id);
      
      if (existingEvent) {
        if (existingEvent.result === 'success') {
          logger.info("[StripeService] Webhook event already processed successfully, skipping:", { 
            eventId: event.id, 
            processedAt: existingEvent.processed_at 
          });
          return { success: true };
        } else {
          logger.warn("[StripeService] Webhook event was previously processed with error, retrying:", { 
            eventId: event.id,
            previousResult: existingEvent.result,
            previousError: existingEvent.error_message
          });
          // Continue to process again if it previously failed
        }
      }

      // Process the event
      let result: 'success' | 'error' = 'success';
      let errorMessage: string | null = null;

      try {
        // Handle different event types
        switch (event.type) {
          case 'checkout.session.completed':
            await this.handleCheckoutSessionCompleted(event);
            break;
          case 'customer.subscription.created':
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted':
            await this.handleSubscriptionEvent(event);
            break;
          case 'invoice.payment_succeeded':
          case 'invoice.payment_failed':
            await this.handleInvoiceEvent(event);
            break;
          default:
            logger.info("[StripeService] Unhandled webhook event type, logging for reference:", { 
              type: event.type, 
              id: event.id 
            });
            // Don't fail for unhandled events, just log them
        }

        // Record successful processing
        await this.webhookEventsRepository.create({
          eventId: event.id,
          eventType: event.type,
          result: 'success',
          metadata: {
            handled: true,
            eventData: event.data.object,
          },
        });

        return { success: true };
      } catch (processingError) {
        result = 'error';
        errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
        
        logger.error("[StripeService] Error processing webhook event:", {
          eventId: event.id,
          eventType: event.type,
          error: errorMessage,
        });

        // Record failed processing
        await this.webhookEventsRepository.create({
          eventId: event.id,
          eventType: event.type,
          result: 'error',
          errorMessage,
          metadata: {
            handled: false,
            error: errorMessage,
          },
        });

        return { 
          success: false, 
          error: errorMessage
        };
      }
    } catch (error) {
      logger.error("[StripeService] Error handling webhook event:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to handle webhook event" 
      };
    }
  }

  /**
   * Handle checkout.session.completed event
   */
  private async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    logger.info("[StripeService] Handling checkout.session.completed:", { sessionId: session.id });
    
    // TODO: Implement checkout session completion logic
    // This should update subscription status in database
  }

  /**
   * Handle subscription events (created, updated, deleted)
   */
  private async handleSubscriptionEvent(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    logger.info("[StripeService] Handling subscription event:", { 
      type: event.type, 
      subscriptionId: subscription.id 
    });
    
    // TODO: Implement subscription event handling logic
    // This should sync subscription status with database
  }

  /**
   * Handle invoice events (payment_succeeded, payment_failed)
   */
  private async handleInvoiceEvent(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    logger.info("[StripeService] Handling invoice event:", { 
      type: event.type, 
      invoiceId: invoice.id 
    });
    
    // TODO: Implement invoice event handling logic
    // This should update payment status in database
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

  /**
   * Sync plan to Stripe (features, prices, product name)
   */
  async syncPlanToStripe(planId: string): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    const warnings: string[] = [];
    
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get plan from database
      const { data: plan, error: planError } = await supabase
        .from("app_plans")
        .select("id, name, price_monthly, price_yearly, features, stripe_product_id, stripe_price_id_monthly, stripe_price_id_yearly")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return { success: false, error: `Plan ${planId} not found` };
      }

      if (!plan.stripe_product_id) {
        return { success: false, error: `Plan ${planId} has no Stripe Product ID configured` };
      }

      // 1. Update product name
      try {
        await stripe.products.update(plan.stripe_product_id, {
          name: plan.name,
        });
        logger.info(`[StripeService] Updated product name: ${plan.name}`);
      } catch (error) {
        warnings.push(`Failed to update product name: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      // 2. Update or create prices
      const currency = "cad";
      
      // Update monthly price
      if (plan.stripe_price_id_monthly) {
        try {
          const currentPrice = await stripe.prices.retrieve(plan.stripe_price_id_monthly);
          const currentAmount = currentPrice.unit_amount || 0;
          const newAmount = Math.round(plan.price_monthly * 100);
          
          if (currentAmount !== newAmount) {
            const newMonthlyPrice = await stripe.prices.create({
              product: plan.stripe_product_id,
              unit_amount: newAmount,
              currency: currency,
              recurring: { interval: "month" },
            });
            
            await stripe.prices.update(plan.stripe_price_id_monthly, { active: false });
            
            await supabase
              .from("app_plans")
              .update({ stripe_price_id_monthly: newMonthlyPrice.id })
              .eq("id", planId);
            
            logger.info(`[StripeService] Updated monthly price: ${newMonthlyPrice.id}`);
          }
        } catch (error) {
          warnings.push(`Failed to update monthly price: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      } else if (plan.price_monthly) {
        try {
          const newMonthlyPrice = await stripe.prices.create({
            product: plan.stripe_product_id,
            unit_amount: Math.round(plan.price_monthly * 100),
            currency: currency,
            recurring: { interval: "month" },
          });
          
          await supabase
            .from("app_plans")
            .update({ stripe_price_id_monthly: newMonthlyPrice.id })
            .eq("id", planId);
          
          logger.info(`[StripeService] Created monthly price: ${newMonthlyPrice.id}`);
        } catch (error) {
          warnings.push(`Failed to create monthly price: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      // Update yearly price
      if (plan.stripe_price_id_yearly) {
        try {
          const currentPrice = await stripe.prices.retrieve(plan.stripe_price_id_yearly);
          const currentAmount = currentPrice.unit_amount || 0;
          const newAmount = Math.round(plan.price_yearly * 100);
          
          if (currentAmount !== newAmount) {
            const newYearlyPrice = await stripe.prices.create({
              product: plan.stripe_product_id,
              unit_amount: newAmount,
              currency: currency,
              recurring: { interval: "year" },
            });
            
            await stripe.prices.update(plan.stripe_price_id_yearly, { active: false });
            
            await supabase
              .from("app_plans")
              .update({ stripe_price_id_yearly: newYearlyPrice.id })
              .eq("id", planId);
            
            logger.info(`[StripeService] Updated yearly price: ${newYearlyPrice.id}`);
          }
        } catch (error) {
          warnings.push(`Failed to update yearly price: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      } else if (plan.price_yearly) {
        try {
          const newYearlyPrice = await stripe.prices.create({
            product: plan.stripe_product_id,
            unit_amount: Math.round(plan.price_yearly * 100),
            currency: currency,
            recurring: { interval: "year" },
          });
          
          await supabase
            .from("app_plans")
            .update({ stripe_price_id_yearly: newYearlyPrice.id })
            .eq("id", planId);
          
          logger.info(`[StripeService] Created yearly price: ${newYearlyPrice.id}`);
        } catch (error) {
          warnings.push(`Failed to create yearly price: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      // 3. Sync features
      const featuresResult = await this.syncPlanFeaturesToStripe(planId);
      if (!featuresResult.success) {
        warnings.push(`Failed to sync features: ${featuresResult.error}`);
      }

      return { success: true, warnings: warnings.length > 0 ? warnings : undefined };
    } catch (error) {
      logger.error("[StripeService] Error syncing plan to Stripe:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  /**
   * Map Stripe subscription status to domain status
   */
  mapStripeStatus(status: Stripe.Subscription.Status): "active" | "cancelled" | "past_due" | "trialing" | "unpaid" {
    switch (status) {
      case "active":
        return "active";
      case "canceled":
      case "unpaid":
        return status === "unpaid" ? "unpaid" : "cancelled";
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
   * Get payment methods for customer
   */
  async getPaymentMethods(userId: string): Promise<{
    paymentMethods: Stripe.PaymentMethod[];
    error: string | null;
  }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get customer ID
      const { data: subscription } = await supabase
        .from("app_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscription?.stripe_customer_id) {
        return { paymentMethods: [], error: "No customer found" };
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.stripe_customer_id,
        type: "card",
      });

      return { paymentMethods: paymentMethods.data, error: null };
    } catch (error) {
      logger.error("[StripeService] Error getting payment methods:", error);
      return { 
        paymentMethods: [], 
        error: error instanceof Error ? error.message : "Failed to get payment methods" 
      };
    }
  }

  /**
   * Create setup intent for adding new payment method
   */
  async createSetupIntent(userId: string): Promise<{
    clientSecret: string | null;
    error: string | null;
  }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get customer ID
      const { data: subscription } = await supabase
        .from("app_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscription?.stripe_customer_id) {
        return { clientSecret: null, error: "No customer found" };
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: subscription.stripe_customer_id,
        payment_method_types: ["card"],
      });

      return { clientSecret: setupIntent.client_secret, error: null };
    } catch (error) {
      logger.error("[StripeService] Error creating setup intent:", error);
      return { 
        clientSecret: null, 
        error: error instanceof Error ? error.message : "Failed to create setup intent" 
      };
    }
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(userId: string, paymentMethodId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get customer ID
      const { data: subscription } = await supabase
        .from("app_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscription?.stripe_customer_id) {
        return { success: false, error: "No customer found" };
      }

      // Verify payment method belongs to customer
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== subscription.stripe_customer_id) {
        return { success: false, error: "Payment method does not belong to customer" };
      }

      await stripe.paymentMethods.detach(paymentMethodId);

      return { success: true, error: null };
    } catch (error) {
      logger.error("[StripeService] Error deleting payment method:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete payment method" 
      };
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get customer ID
      const { data: subscription } = await supabase
        .from("app_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscription?.stripe_customer_id) {
        return { success: false, error: "No customer found" };
      }

      // Verify payment method belongs to customer
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== subscription.stripe_customer_id) {
        return { success: false, error: "Payment method does not belong to customer" };
      }

      // Attach payment method to customer if not already attached
      if (!paymentMethod.customer) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: subscription.stripe_customer_id,
        });
      }

      // Update customer's default payment method
      await stripe.customers.update(subscription.stripe_customer_id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      return { success: true, error: null };
    } catch (error) {
      logger.error("[StripeService] Error setting default payment method:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to set default payment method" 
      };
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscriptionPlan(
    userId: string,
    newPlanId: string,
    interval: "month" | "year" = "month"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get user subscription
      const { data: subscription, error: subError } = await supabase
        .from("app_subscriptions")
        .select("id, stripe_subscription_id, plan_id")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError || !subscription || !subscription.stripe_subscription_id) {
        return { success: false, error: "Active subscription not found" };
      }

      // Get new plan
      const { data: newPlan, error: planError } = await supabase
        .from("app_plans")
        .select("*")
        .eq("id", newPlanId)
        .single();

      if (planError || !newPlan) {
        return { success: false, error: "Plan not found" };
      }

      const newPriceId = interval === "month" 
        ? newPlan.stripe_price_id_monthly 
        : newPlan.stripe_price_id_yearly;

      if (!newPriceId) {
        return { success: false, error: "Stripe price ID not configured for this plan" };
      }

      // Get current subscription from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      
      // Update subscription
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: "always_invoice",
        metadata: {
          ...stripeSubscription.metadata,
          planId: newPlanId,
          interval: interval,
        },
      });

      // Update database
      await supabase
        .from("app_subscriptions")
        .update({ 
          plan_id: newPlanId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      logger.info(`[StripeService] Updated subscription plan for user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error("[StripeService] Error updating subscription plan:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update subscription plan",
      };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    userId: string,
    cancelImmediately: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get user subscription
      const { data: subscription, error: subError } = await supabase
        .from("app_subscriptions")
        .select("stripe_subscription_id, id")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError || !subscription || !subscription.stripe_subscription_id) {
        return { success: false, error: "Active subscription not found" };
      }

      if (cancelImmediately) {
        // Cancel immediately
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        
        await supabase
          .from("app_subscriptions")
          .update({ 
            status: "cancelled",
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
      } else {
        // Cancel at period end
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        
        await supabase
          .from("app_subscriptions")
          .update({ 
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
      }

      logger.info(`[StripeService] Cancelled subscription for user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error("[StripeService] Error cancelling subscription:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cancel subscription",
      };
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get user subscription
      const { data: subscription, error: subError } = await supabase
        .from("app_subscriptions")
        .select("stripe_subscription_id, id")
        .eq("user_id", userId)
        .eq("cancel_at_period_end", true)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError || !subscription || !subscription.stripe_subscription_id) {
        return { success: false, error: "No subscription scheduled for cancellation found" };
      }

      // Remove cancellation
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
      
      await supabase
        .from("app_subscriptions")
        .update({ 
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      logger.info(`[StripeService] Reactivated subscription for user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error("[StripeService] Error reactivating subscription:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reactivate subscription",
      };
    }
  }

  /**
   * Create embedded checkout session
   */
  async createEmbeddedCheckoutSession(
    userId: string,
    planId: string,
    interval: "month" | "year" = "month",
    promoCode?: string
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser || authUser.id !== userId) {
        return { success: false, error: "Unauthorized" };
      }

      // Get or create active household ID
      const { getActiveHouseholdId } = await import("@/lib/utils/household");
      let householdId = await getActiveHouseholdId(userId);
      
      if (!householdId) {
        // CRITICAL: Create personal household if it doesn't exist
        // This ensures users can create subscriptions even if household wasn't created during signup
        logger.info("[StripeService] No active household found, creating personal household for user:", userId);
        
        try {
          const { makeMembersService } = await import("../members/members.factory");
          const membersService = makeMembersService();
          
          // Get user name for household name
          const supabase = await createServerClient();
          const { data: userData } = await supabase
            .from("users")
            .select("name")
            .eq("id", userId)
            .maybeSingle();
          
          const householdName = userData?.name ? `${userData.name}'s Account` : "Minha Conta";
          
          const newHousehold = await membersService.createHousehold(
            userId,
            householdName,
            'personal'
          );
          
          householdId = newHousehold.id;
          logger.info("[StripeService] Personal household created successfully:", { userId, householdId });
        } catch (householdError) {
          logger.error("[StripeService] Error creating personal household:", householdError);
          return { 
            success: false, 
            error: "Failed to create household. Please contact support." 
          };
        }
      }
      
      // Move temporary income to household settings and generate initial data if exists
      const { makeProfileService } = await import("@/src/application/profile/profile.factory");
      const profileService = makeProfileService();
      const profile = await profileService.getProfile();
      
      if (profile?.temporaryExpectedIncome) {
        const { makeOnboardingService } = await import("@/src/application/onboarding/onboarding.factory");
        const onboardingService = makeOnboardingService();
        const incomeRange = profile.temporaryExpectedIncome;
        const incomeAmount = profile.temporaryExpectedIncomeAmount;
        
        // Save income to household settings
        await onboardingService.saveExpectedIncome(
          userId,
          incomeRange,
          undefined,
          undefined,
          incomeAmount
        );
        
        // Clear temporary income from profile
        await profileService.updateProfile({ 
          temporaryExpectedIncome: null,
          temporaryExpectedIncomeAmount: null 
        });
      }

      // Get plan
      const { data: plan, error: planError } = await supabase
        .from("app_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return { success: false, error: "Plan not found" };
      }

      const priceId = interval === "month" 
        ? plan.stripe_price_id_monthly 
        : plan.stripe_price_id_yearly;

      if (!priceId) {
        return { success: false, error: "Stripe price ID not configured for this plan" };
      }

      // Get or create Stripe customer
      let customerId: string;
      const { data: subscription } = await supabase
        .from("app_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.stripe_customer_id) {
        customerId = subscription.stripe_customer_id;
      } else {
        // Get user data
        const { data: userData } = await supabase
          .from("users")
          .select("name, email")
          .eq("id", userId)
          .single();

        // Create Stripe customer
        const customer = await stripe.customers.create({
          email: userData?.email || authUser.email || undefined,
          name: userData?.name || undefined,
          metadata: {
            userId: userId,
            householdId: householdId,
          },
        });

        customerId = customer.id;
      }

      // Get promo code if provided
      let stripeCouponId: string | undefined;
      if (promoCode) {
        const { data: promoCodeData } = await supabase
          .from("system_promo_codes")
          .select("stripe_coupon_id, is_active, expires_at, plan_ids")
          .eq("code", promoCode.toUpperCase())
          .single();

        if (promoCodeData && promoCodeData.is_active) {
          if (promoCodeData.expires_at && new Date(promoCodeData.expires_at) < new Date()) {
            return { success: false, error: "Promo code has expired" };
          }

          const planIds = (promoCodeData.plan_ids || []) as string[];
          if (planIds.length > 0 && !planIds.includes(planId)) {
            return { success: false, error: "Promo code not valid for this plan" };
          }

          stripeCouponId = promoCodeData.stripe_coupon_id || undefined;
        } else {
          return { success: false, error: "Promo code not found" };
        }
      }

      // Create subscription with trial directly (not checkout session)
      // For trial subscriptions, we use payment_behavior: "default_incomplete"
      // This allows creating subscription without payment method - payment will be collected when trial ends
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { 
          save_default_payment_method: "on_subscription",
        },
        trial_period_days: 30,
        metadata: {
          userId: userId,
          householdId: householdId,
          planId: planId,
          interval: interval,
        },
      };

      // Add promo code if provided
      if (stripeCouponId) {
        subscriptionParams.discounts = [{ coupon: stripeCouponId }];
      }

      // Create subscription in Stripe (will be in trialing state, no payment required)
      const stripeSubscription = await stripe.subscriptions.create(subscriptionParams);
      
      logger.info("[StripeService] Stripe subscription created:", {
        subscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        trialEnd: stripeSubscription.trial_end,
      });

      // Create subscription in Supabase database
      const subscriptionId = `${userId}-${planId}`;
      const trialStartDate = stripeSubscription.trial_start 
        ? new Date(stripeSubscription.trial_start * 1000)
        : new Date();
      const trialEndDate = stripeSubscription.trial_end 
        ? new Date(stripeSubscription.trial_end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // CRITICAL: Use service role client to bypass RLS during creation
      // This ensures the subscription is created even if there are timing issues with RLS policies
      // The RLS policies will still protect access after creation
      const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
      const serviceRoleClient = createServiceRoleClient();

      const { data: newSubscription, error: insertError } = await serviceRoleClient
        .from("app_subscriptions")
        .insert({
          id: subscriptionId,
          user_id: userId,
          household_id: householdId,
          plan_id: planId,
          status: "trialing",
          stripe_subscription_id: stripeSubscription.id,
          stripe_customer_id: customerId,
          trial_start_date: trialStartDate.toISOString(),
          trial_end_date: trialEndDate.toISOString(),
          current_period_start: (stripeSubscription as any).current_period_start 
            ? new Date((stripeSubscription as any).current_period_start * 1000).toISOString()
            : trialStartDate.toISOString(),
          current_period_end: (stripeSubscription as any).current_period_end 
            ? new Date((stripeSubscription as any).current_period_end * 1000).toISOString()
            : trialEndDate.toISOString(),
          cancel_at_period_end: false,
        })
        .select()
        .single();

      if (insertError || !newSubscription) {
        logger.error("[StripeService] Error creating subscription in database:", insertError);
        // Try to cancel Stripe subscription if database insert fails
        try {
          await stripe.subscriptions.cancel(stripeSubscription.id);
        } catch (cancelError) {
          logger.error("[StripeService] Error canceling Stripe subscription:", cancelError);
        }
        return { success: false, error: "Failed to create subscription in database" };
      }

      logger.info("[StripeService] Subscription created successfully:", { 
        subscriptionId: newSubscription.id,
        stripeSubscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        householdId: householdId,
      });

      return { 
        success: true, 
        subscriptionId: newSubscription.id,
        error: undefined 
      };
    } catch (error) {
      logger.error("[StripeService] Error creating embedded checkout session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create embedded checkout session",
      };
    }
  }

  /**
   * Update subscription trial end date
   */
  async updateSubscriptionTrial(
    userId: string,
    trialEndDate: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get subscription
      const { data: subscription, error: subError } = await supabase
        .from("app_subscriptions")
        .select("id, stripe_subscription_id, status, trial_end_date")
        .eq("user_id", userId)
        .not("stripe_subscription_id", "is", null)
        .in("status", ["trialing", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError || !subscription?.stripe_subscription_id) {
        return { success: false, error: "No active subscription found" };
      }

      if (subscription.status !== "trialing") {
        return { success: false, error: "Subscription is not in trial period" };
      }

      const now = new Date();
      if (trialEndDate <= now) {
        return { success: false, error: "Trial end date must be in the future" };
      }

      const trialEndTimestamp = Math.floor(trialEndDate.getTime() / 1000);

      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        trial_end: trialEndTimestamp,
      });

      // Invalidate cache
      const { makeSubscriptionsService } = await import("../subscriptions/subscriptions.factory");
      const subscriptionsService = makeSubscriptionsService();

      logger.info(`[StripeService] Updated subscription trial for user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error("[StripeService] Error updating subscription trial:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update subscription trial",
      };
    }
  }

  /**
   * Sync plan features to Stripe using Features API
   */
  private async syncPlanFeaturesToStripe(planId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = getStripeClient();
      const supabase = await createServerClient();
      
      // Get plan from database
      const { data: plan, error: planError } = await supabase
        .from("app_plans")
        .select("id, name, features, stripe_product_id")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return { success: false, error: `Plan ${planId} not found` };
      }

      if (!plan.stripe_product_id) {
        return { success: false, error: `Plan ${planId} has no Stripe Product ID configured` };
      }

      const FEATURE_DEFINITIONS = [
        { lookupKey: "investments", name: "Investments", description: "Investment tracking and portfolio management" },
        { lookupKey: "household", name: "Household Members", description: "Add and manage household members" },
        { lookupKey: "advanced_reports", name: "Advanced Reports", description: "Access to advanced financial reports" },
        { lookupKey: "csv_export", name: "CSV Export", description: "Export data to CSV format" },
        { lookupKey: "csv_import", name: "CSV Import", description: "Import data from CSV files" },
        { lookupKey: "debts", name: "Debt Tracking", description: "Track and manage debts" },
        { lookupKey: "goals", name: "Goals", description: "Set and track financial goals" },
        { lookupKey: "bank_integration", name: "Bank Integration", description: "Import bank transactions via CSV" },
        { lookupKey: "receipt_scanner", name: "Receipt Scanner", description: "AI-powered receipt scanning and transaction extraction" },
      ] as const;

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
        receipt_scanner: plan.features.hasReceiptScanner,
      };

      // Create/update all features in Stripe
      const featureIds: string[] = [];
      for (const featureDef of FEATURE_DEFINITIONS) {
        if (featureMap[featureDef.lookupKey]) {
          try {
            const featureId = await this.ensureStripeFeature(
              featureDef.lookupKey,
              featureDef.name,
              featureDef.description
            );
            featureIds.push(featureId);
            logger.info(`[StripeService] Feature ${featureDef.lookupKey} ensured: ${featureId}`);
          } catch (error) {
            logger.error(`[StripeService] Error ensuring feature ${featureDef.lookupKey}:`, error);
          }
        }
      }

      // Update product with features metadata
      const metadata: Record<string, string> = {
        planId: plan.id,
        planName: plan.name,
        hasInvestments: String(plan.features.hasInvestments),
        hasAdvancedReports: String(plan.features.hasAdvancedReports),
        hasCsvExport: String(plan.features.hasCsvExport),
        hasCsvImport: String(plan.features.hasCsvImport),
        hasDebts: String(plan.features.hasDebts),
        hasGoals: String(plan.features.hasGoals),
        hasBankIntegration: String(plan.features.hasBankIntegration),
        hasHousehold: String(plan.features.hasHousehold),
        maxTransactions: String(plan.features.maxTransactions),
        maxAccounts: String(plan.features.maxAccounts),
        featureIds: featureIds.join(","),
        features: JSON.stringify(plan.features),
      };

      await stripe.products.update(plan.stripe_product_id, {
        metadata,
      });

      return { success: true };
    } catch (error) {
      logger.error("[StripeService] Error syncing plan features to Stripe:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create or update a Stripe Feature (private method)
   */
  private async ensureStripeFeature(
    lookupKey: string,
    name: string,
    description: string
  ): Promise<string> {
    const stripe = getStripeClient();
    
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
      logger.error(`[StripeService] Error ensuring feature ${lookupKey}:`, error);
      throw error;
    }
  }

  /**
   * Get subscription interval (monthly/yearly) from Stripe
   * @param stripeSubscriptionId - Stripe subscription ID
   * @param plan - Plan object with stripePriceIdMonthly and stripePriceIdYearly
   * @returns "month" | "year" | null
   */
  async getSubscriptionInterval(
    stripeSubscriptionId: string,
    plan: { stripePriceIdMonthly?: string | null; stripePriceIdYearly?: string | null }
  ): Promise<"month" | "year" | null> {
    try {
      const stripe = getStripeClient();
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const priceId = stripeSubscription.items.data[0]?.price.id;
      
      if (priceId && plan) {
        if (plan.stripePriceIdMonthly === priceId) {
          return "month";
        } else if (plan.stripePriceIdYearly === priceId) {
          return "year";
        }
      }
      return null;
    } catch (error) {
      logger.error("[StripeService] Error fetching Stripe subscription interval:", error);
      return null;
    }
  }

  /**
   * Create or get Stripe customer for a user
   * Creates customer immediately after signup (new flow)
   * @param userId - User ID
   * @param email - User email
   * @param name - User name (optional)
   * @param householdId - Household ID (optional)
   * @returns Stripe customer ID
   */
  async createOrGetStripeCustomer(
    userId: string,
    email: string,
    name?: string | null,
    householdId?: string | null
  ): Promise<{ customerId: string; isNew: boolean }> {
    try {
      const supabase = await createServerClient();
      const stripe = getStripeClient();

      // Check if user already has a Stripe customer in existing subscription
      const { data: existingSubscription } = await supabase
        .from("app_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSubscription?.stripe_customer_id) {
        // Update existing customer with latest info
        try {
          await stripe.customers.update(existingSubscription.stripe_customer_id, {
            email,
            name: name || undefined,
            metadata: {
              userId,
              ...(householdId && { householdId }),
            },
          });
          logger.info("[StripeService] Updated existing Stripe customer:", {
            customerId: existingSubscription.stripe_customer_id,
            email,
            name,
          });
        } catch (updateError) {
          logger.error("[StripeService] Error updating existing Stripe customer:", updateError);
          // Continue anyway - customer exists
        }
        return {
          customerId: existingSubscription.stripe_customer_id,
          isNew: false,
        };
      }

      // Check if customer exists in Stripe by email
      const customers = await stripe.customers.list({
        email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        const customer = customers.data[0];
        // Update customer metadata if it doesn't have userId
        if (!customer.metadata?.userId || customer.metadata.userId !== userId) {
          try {
            await stripe.customers.update(customer.id, {
              name: name || undefined,
              metadata: {
                userId,
                ...(householdId && { householdId }),
              },
            });
          } catch (updateError) {
            logger.error("[StripeService] Error updating customer metadata:", updateError);
          }
        }
        logger.info("[StripeService] Found existing Stripe customer by email:", {
          customerId: customer.id,
          email,
        });
        return {
          customerId: customer.id,
          isNew: false,
        };
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        name: name || undefined,
        metadata: {
          userId,
          ...(householdId && { householdId }),
        },
      });

      logger.info("[StripeService] Created new Stripe customer:", {
        customerId: customer.id,
        email,
        name,
      });

      return {
        customerId: customer.id,
        isNew: true,
      };
    } catch (error) {
      logger.error("[StripeService] Error creating or getting Stripe customer:", error);
      throw new Error(`Failed to create Stripe customer: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Link a Stripe subscription to a user account by email
   * Used when a user signs up after completing checkout
   */
  async linkSubscriptionByEmail(
    userId: string,
    email: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const stripe = getStripeClient();

      // Find Stripe customer by email
      const customers = await stripe.customers.list({
        email: email.toLowerCase(),
        limit: 1,
      });

      if (customers.data.length === 0) {
        return {
          success: false,
          message: "No Stripe customer found with this email",
          error: "No Stripe customer found with this email",
        };
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
        return {
          success: false,
          message: "No subscription found for this customer",
          error: "No subscription found for this customer",
        };
      }

      const stripeSubscription = subscriptions.data[0];

      // Get price ID to find plan
      const priceId = stripeSubscription.items.data[0]?.price.id;
      if (!priceId) {
        return {
          success: false,
          message: "No price ID found in subscription",
          error: "No price ID found in subscription",
        };
      }

      // Find plan by price ID
      const plan = await this.subscriptionsRepository.findPlanByPriceId(priceId, true);
      if (!plan) {
        return {
          success: false,
          message: "Plan not found for this subscription",
          error: "Plan not found for this subscription",
        };
      }

      // Get user name and update customer metadata
      const supabase = await createServerClient();
      const { data: userData } = await supabase
        .from("users")
        .select("name")
        .eq("id", userId)
        .maybeSingle();

      // Update customer with email, name, and metadata
      await stripe.customers.update(customerId, {
        email: email,
        name: userData?.name || undefined,
        metadata: {
          userId: userId,
        },
      });

      // Get active household ID
      const householdId = await getActiveHouseholdId(userId);
      if (!householdId) {
        logger.error("[StripeService] No active household found for user:", userId);
        return {
          success: false,
          message: "No active household found. Please contact support.",
          error: "No active household found",
        };
      }

      const subscriptionId = `${userId}-${plan.id}`;

      // Check for existing subscription (pending by email, by customer ID, or by subscription ID)
      const pendingSubByEmail = await this.subscriptionsRepository.findByPendingEmail(email, true);
      const existingSubByCustomer = await this.subscriptionsRepository.findByStripeCustomerId(customerId, true);
      const existingSubById = await this.subscriptionsRepository.findById(subscriptionId, true);

      const existingSub = pendingSubByEmail || existingSubByCustomer || existingSubById;

      // Map Stripe status to our status
      const status = stripeSubscription.status === "active" ? "active" as const
        : stripeSubscription.status === "trialing" ? "trialing" as const
        : stripeSubscription.status === "past_due" ? "past_due" as const
        : "cancelled" as const;

      // Extract period dates from Stripe subscription
      // Stripe uses Unix timestamps (seconds), but TypeScript types don't expose these
      const stripeSub = stripeSubscription as unknown as {
        current_period_start?: number;
        current_period_end?: number;
        trial_start?: number | null;
        trial_end?: number | null;
      };

      const currentPeriodStart = stripeSub.current_period_start
        ? new Date(stripeSub.current_period_start * 1000).toISOString()
        : new Date().toISOString();
      const currentPeriodEnd = stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000).toISOString()
        : new Date().toISOString();
      const trialStartDate = stripeSub.trial_start
        ? new Date(stripeSub.trial_start * 1000).toISOString()
        : null;
      const trialEndDate = stripeSub.trial_end
        ? new Date(stripeSub.trial_end * 1000).toISOString()
        : null;

      const now = new Date().toISOString();

      if (existingSub) {
        // Update existing subscription
        if (existingSub.id !== subscriptionId) {
          // Delete old subscription and create new with correct ID
          logger.info("[StripeService] Subscription ID mismatch, recreating:", {
            oldId: existingSub.id,
            newId: subscriptionId,
          });

          await this.subscriptionsRepository.delete(existingSub.id, true);

          await this.subscriptionsRepository.create({
            id: subscriptionId,
            userId: userId,
            householdId: householdId,
            planId: plan.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId: customerId,
            status: status,
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            trialStartDate: trialStartDate,
            trialEndDate: trialEndDate,
            pendingEmail: null,
            createdAt: now,
            updatedAt: now,
          }, true);
        } else {
          // Update existing subscription
          await this.subscriptionsRepository.update(subscriptionId, {
            userId: userId,
            householdId: householdId,
            planId: plan.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId: customerId,
            status: status,
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            trialStartDate: trialStartDate,
            trialEndDate: trialEndDate,
            pendingEmail: null,
            updatedAt: now,
          }, true);
        }
      } else {
        // Create new subscription
        await this.subscriptionsRepository.create({
          id: subscriptionId,
          userId: userId,
          householdId: householdId,
          planId: plan.id,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId: customerId,
          status: status,
          currentPeriodStart: currentPeriodStart,
          currentPeriodEnd: currentPeriodEnd,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          trialStartDate: trialStartDate,
          trialEndDate: trialEndDate,
          pendingEmail: null,
          createdAt: now,
          updatedAt: now,
        }, true);
      }

      logger.info("[StripeService] Subscription linked successfully:", {
        subscriptionId,
        userId,
        email,
      });

      return {
        success: true,
        message: "Subscription linked successfully",
      };
    } catch (error) {
      logger.error("[StripeService] Error linking subscription:", error);
      return {
        success: false,
        message: "Failed to link subscription",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get Stripe customer information for the current user
   * Returns customer ID and email for use with Stripe Pricing Table
   */
  async getCustomerInfo(userId: string): Promise<{
    customerId: string | null;
    customerEmail: string | null;
    userId: string | null;
  }> {
    try {
      const supabase = await createServerClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        throw new AppError("Unauthorized", 401);
      }

      // Get subscription data to find customer ID
      const subscription = await this.subscriptionsRepository.findByUserId(userId, false);
      const customerId = subscription?.stripe_customer_id || null;

      return {
        customerId: customerId,
        customerEmail: authUser.email || null,
        userId: authUser.id || null,
      };
    } catch (error) {
      logger.error("[StripeService] Error getting customer info:", error);
      throw error instanceof AppError ? error : new AppError(
        "Failed to fetch customer information",
        500
      );
    }
  }

  /**
   * Link Stripe subscription to a newly created account
   * Used when a user completes checkout before signing up
   * @param userId - The newly created user ID
   * @param customerId - The Stripe customer ID
   * @param email - User email
   * @param name - User name (optional)
   * @returns Result with success status and message
   */
  async linkSubscriptionToNewAccount(
    userId: string,
    customerId: string,
    email: string,
    name?: string | null
  ): Promise<{
    success: boolean;
    message: string;
    userId?: string;
    error?: string;
  }> {
    try {
      const stripe = getStripeClient();

      // Find active subscription for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        // User created but no subscription found - this is OK, they can link later
        logger.info("[StripeService] User created but no subscription found yet:", { userId, customerId });
        return {
          success: true,
          message: "Account created successfully. Subscription will be linked automatically.",
          userId: userId,
        };
      }

      const stripeSubscription = subscriptions.data[0];

      // Get price ID to find plan
      const priceId = stripeSubscription.items.data[0]?.price.id;
      if (!priceId) {
        return {
          success: false,
          message: "No price ID found in subscription",
          error: "No price ID found in subscription",
        };
      }

      // Find plan by price ID
      const plan = await this.subscriptionsRepository.findPlanByPriceId(priceId, true);
      if (!plan) {
        return {
          success: false,
          message: "Plan not found for this subscription",
          error: "Plan not found for this subscription",
        };
      }

      // Update customer with email, name, and metadata
      await stripe.customers.update(customerId, {
        email: email,
        name: name || undefined,
        metadata: {
          userId: userId,
        },
      });

      // Get active household ID
      let householdId = await getActiveHouseholdId(userId);
      if (!householdId) {
        // Wait a bit for household to be created
        await new Promise(resolve => setTimeout(resolve, 500));
        householdId = await getActiveHouseholdId(userId);
      }

      if (!householdId) {
        logger.error("[StripeService] No active household found for user:", userId);
        return {
          success: true,
          message: "Account created. Subscription linking may need to be completed later.",
          userId: userId,
        };
      }

      const subscriptionId = `${userId}-${plan.id}`;

      // Check for existing subscription (pending by customer ID, by email, or by subscription ID)
      const pendingSubByCustomer = await this.subscriptionsRepository.findByStripeCustomerId(customerId, true);
      const pendingSubByEmail = await this.subscriptionsRepository.findByPendingEmail(email.toLowerCase(), true);
      const existingSubById = await this.subscriptionsRepository.findById(subscriptionId, true);

      const existingSub = pendingSubByCustomer || pendingSubByEmail || existingSubById;

      // Map Stripe status to our status
      const status = stripeSubscription.status === "active" ? "active" as const
        : stripeSubscription.status === "trialing" ? "trialing" as const
        : stripeSubscription.status === "past_due" ? "past_due" as const
        : "cancelled" as const;

      // Extract period dates from Stripe subscription
      const stripeSub = stripeSubscription as unknown as {
        current_period_start?: number;
        current_period_end?: number;
        trial_start?: number | null;
        trial_end?: number | null;
      };

      const currentPeriodStart = stripeSub.current_period_start
        ? new Date(stripeSub.current_period_start * 1000).toISOString()
        : new Date().toISOString();
      const currentPeriodEnd = stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000).toISOString()
        : new Date().toISOString();
      const trialStartDate = stripeSub.trial_start
        ? new Date(stripeSub.trial_start * 1000).toISOString()
        : null;
      const trialEndDate = stripeSub.trial_end
        ? new Date(stripeSub.trial_end * 1000).toISOString()
        : null;

      const now = new Date().toISOString();

      if (existingSub) {
        // Update existing subscription
        if (existingSub.id !== subscriptionId) {
          // Delete old subscription and create new with correct ID
          logger.info("[StripeService] Subscription ID mismatch, recreating:", {
            oldId: existingSub.id,
            newId: subscriptionId,
          });

          await this.subscriptionsRepository.delete(existingSub.id, true);

          await this.subscriptionsRepository.create({
            id: subscriptionId,
            userId: userId,
            householdId: householdId,
            planId: plan.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId: customerId,
            status: status,
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            trialStartDate: trialStartDate,
            trialEndDate: trialEndDate,
            pendingEmail: null,
            createdAt: now,
            updatedAt: now,
          }, true);
        } else {
          // Update existing subscription
          await this.subscriptionsRepository.update(subscriptionId, {
            userId: userId,
            householdId: householdId,
            planId: plan.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId: customerId,
            status: status,
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            trialStartDate: trialStartDate,
            trialEndDate: trialEndDate,
            pendingEmail: null,
            updatedAt: now,
          }, true);
        }
      } else {
        // Create new subscription
        await this.subscriptionsRepository.create({
          id: subscriptionId,
          userId: userId,
          householdId: householdId,
          planId: plan.id,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId: customerId,
          status: status,
          currentPeriodStart: currentPeriodStart,
          currentPeriodEnd: currentPeriodEnd,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          trialStartDate: trialStartDate,
          trialEndDate: trialEndDate,
          pendingEmail: null,
          createdAt: now,
          updatedAt: now,
        }, true);
      }

      logger.info("[StripeService] Subscription linked to new account successfully:", {
        subscriptionId,
        userId,
        email,
      });

      return {
        success: true,
        message: "Account created and subscription linked successfully",
        userId: userId,
      };
    } catch (error) {
      logger.error("[StripeService] Error linking subscription to new account:", error);
      return {
        success: true,
        message: "Account created. Subscription linking may need to be completed later.",
        userId: userId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

