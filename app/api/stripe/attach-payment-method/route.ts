import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { setupIntentId } = body;

    if (!setupIntentId) {
      return NextResponse.json(
        { error: "setupIntentId is required" },
        { status: 400 }
      );
    }

    // Require authentication
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Retrieve the Setup Intent
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (!setupIntent.payment_method) {
      return NextResponse.json(
        { error: "Payment method not found in setup intent" },
        { status: 400 }
      );
    }

    const paymentMethodId = typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method.id;

    // Get subscription ID from metadata
    const subscriptionId = setupIntent.metadata?.subscriptionId;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID not found in setup intent metadata" },
        { status: 400 }
      );
    }

    // Get customer ID from subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method for customer
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update subscription to use this payment method
    await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    });

    console.log("[ATTACH-PAYMENT-METHOD] Payment method attached successfully:", {
      paymentMethodId,
      subscriptionId,
      customerId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ATTACH-PAYMENT-METHOD] Error attaching payment method:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to attach payment method" },
      { status: 500 }
    );
  }
}

