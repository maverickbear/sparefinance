/**
 * Stripe Client
 * Infrastructure layer for Stripe API client initialization
 */

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * Get or create Stripe client instance
 */
export function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
    typescript: true,
  });

  return stripeClient;
}

