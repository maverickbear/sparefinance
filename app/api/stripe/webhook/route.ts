import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { handleWebhookEvent } from "@/lib/api/stripe";
import { headers } from "next/headers";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export async function POST(request: NextRequest) {
  try {
    console.log("[WEBHOOK:ROUTE] Webhook endpoint called");
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      console.error("[WEBHOOK:ROUTE] Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("[WEBHOOK:ROUTE] STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "STRIPE_WEBHOOK_SECRET is not configured" },
        { status: 500 }
      );
    }

    // Verify webhook signature
    // The constructEvent method automatically verifies:
    // 1. The signature is valid
    // 2. The timestamp is recent (default tolerance: 5 minutes)
    // This prevents replay attacks
    let event: Stripe.Event;
    try {
      console.log("[WEBHOOK:ROUTE] Verifying webhook signature...");
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
        // Optional: customize timestamp tolerance (default is 300 seconds / 5 minutes)
        // For production, 5 minutes is recommended to account for clock skew
      );
      console.log("[WEBHOOK:ROUTE] Webhook signature verified successfully");
    } catch (err) {
      console.error("[WEBHOOK:ROUTE] Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    // Handle the event
    console.log("[WEBHOOK:ROUTE] Handling webhook event:", event.type);
    const result = await handleWebhookEvent(event);

    if (!result.success) {
      console.error("[WEBHOOK:ROUTE] Webhook event handling failed:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to handle webhook event" },
        { status: 500 }
      );
    }

    console.log("[WEBHOOK:ROUTE] Webhook event handled successfully");
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[WEBHOOK:ROUTE] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

