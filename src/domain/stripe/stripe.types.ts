/**
 * Domain types for Stripe integration
 * Pure TypeScript types with no external dependencies
 */

/**
 * Checkout session data
 */
export interface CheckoutSessionData {
  planId: string;
  priceId: string; // monthly or yearly
  mode: "subscription";
}

/**
 * Stripe customer information
 */
export interface StripeCustomer {
  id: string;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, string>;
}

/**
 * Stripe subscription information
 */
export interface StripeSubscription {
  id: string;
  customerId: string;
  status: string;
  planId?: string;
  priceId?: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Stripe invoice information
 */
export interface StripeInvoice {
  id: string;
  customerId: string;
  subscriptionId?: string | null;
  amount: number;
  currency: string;
  status: string;
  paid: boolean;
  created: Date;
  hostedInvoiceUrl?: string | null;
  invoicePdf?: string | null;
}

/**
 * Stripe payment method information
 */
export interface StripePaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
}

/**
 * Result of checkout session creation
 */
export interface CheckoutSessionResult {
  url: string | null;
  error: string | null;
}

/**
 * Result of webhook event handling
 */
export interface WebhookEventResult {
  success: boolean;
  error?: string;
}

