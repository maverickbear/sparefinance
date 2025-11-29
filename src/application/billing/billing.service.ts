/**
 * Billing Service
 * Business logic for billing data aggregation
 * This service aggregates subscription, plan, limits, and usage data
 */

import { BaseBillingData, BaseLimitCheckResult } from "../../domain/billing/billing.types";
import { makeSubscriptionsService } from "../subscriptions/subscriptions.factory";
import { createServerClient } from "../../infrastructure/database/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export class BillingService {
  /**
   * Get billing data (subscription + plan + limits + usage)
   */
  async getBillingData(userId: string): Promise<BaseBillingData> {
    const subscriptionsService = makeSubscriptionsService();

    // Get subscription data
    const subscriptionData = await subscriptionsService.getUserSubscriptionData(userId);

    // Get limits in parallel
    const [transactionLimit, accountLimit] = await Promise.all([
      subscriptionsService.checkTransactionLimit(userId),
      subscriptionsService.checkAccountLimit(userId),
    ]);

    // Get billing interval from Stripe if subscription exists
    let interval: "month" | "year" | null = null;
    if (subscriptionData.subscription?.stripeSubscriptionId) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscriptionData.subscription.stripeSubscriptionId
        );
        const priceId = stripeSubscription.items.data[0]?.price.id;
        if (priceId) {
          const price = await stripe.prices.retrieve(priceId);
          interval = price.recurring?.interval === "year" ? "year" : "month";
        }
      } catch (error) {
        // If Stripe call fails, continue without interval
        console.error("Error fetching Stripe subscription interval:", error);
      }
    }

    return {
      subscription: subscriptionData.subscription,
      plan: subscriptionData.plan,
      limits: subscriptionData.limits,
      transactionLimit,
      accountLimit,
      interval,
    };
  }

  /**
   * Get payment methods from Stripe
   */
  async getPaymentMethods(userId: string): Promise<Array<{
    id: string;
    type: string;
    card?: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    };
  }>> {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return [];
    }

    // Get subscription to find Stripe customer ID
    const { data: subscription } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription?.stripeCustomerId) {
      return [];
    }

    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.stripeCustomerId,
        type: "card",
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : undefined,
      }));
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      return [];
    }
  }

  /**
   * Get invoices from Stripe
   */
  async getInvoices(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      startingAfter?: string;
    }
  ): Promise<{
    invoices: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      created: number;
      invoicePdf: string | null;
      hostedInvoiceUrl: string | null;
    }>;
    hasMore: boolean;
    total: number;
  }> {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return { invoices: [], hasMore: false, total: 0 };
    }

    // Get subscription to find Stripe customer ID
    const { data: subscription } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription?.stripeCustomerId) {
      return { invoices: [], hasMore: false, total: 0 };
    }

    const page = options?.page || 1;
    const limit = options?.limit || 10;

    try {
      const params: Stripe.InvoiceListParams = {
        customer: subscription.stripeCustomerId,
        limit: limit + 1, // Fetch one extra to check if there are more
      };

      if (options?.startingAfter) {
        params.starting_after = options.startingAfter;
      }

      const invoices = await stripe.invoices.list(params);

      const hasMore = invoices.data.length > limit;
      const invoicesToReturn = hasMore ? invoices.data.slice(0, limit) : invoices.data;

      return {
        invoices: invoicesToReturn.map(inv => ({
          id: inv.id,
          amount: inv.amount_paid,
          currency: inv.currency,
          status: inv.status || "draft",
          created: inv.created,
          invoicePdf: inv.invoice_pdf || null,
          hostedInvoiceUrl: inv.hosted_invoice_url || null,
        })),
        hasMore,
        total: invoices.data.length,
      };
    } catch (error) {
      console.error("Error fetching invoices:", error);
      return { invoices: [], hasMore: false, total: 0 };
    }
  }
}

