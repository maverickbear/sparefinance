import { NextRequest, NextResponse } from "next/server";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";
import { AppError } from "@/src/application/shared/app-error";
import { headers } from "next/headers";

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not set");
}

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

    // Verify webhook signature using service
    const stripeService = makeStripeService();
    let event;
    try {
      console.log("[WEBHOOK:ROUTE] Verifying webhook signature...");
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
      }
      event = stripeService.verifyWebhookSignature(
        body,
        signature,
        webhookSecret
      );
      console.log("[WEBHOOK:ROUTE] Webhook signature verified successfully");
    } catch (err) {
      console.error("[WEBHOOK:ROUTE] Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    // Handle the event (with idempotency check inside service)
    console.log("[WEBHOOK:ROUTE] Handling webhook event:", event.type, event.id);
    const result = await stripeService.handleWebhookEvent(event);

    if (!result.success) {
      console.error("[WEBHOOK:ROUTE] Webhook event handling failed:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to handle webhook event" },
        { status: 500 }
      );
    }

    console.log("[WEBHOOK:ROUTE] Webhook event handled successfully (idempotent)");
    return NextResponse.json({ received: true, eventId: event.id });
  } catch (error) {
    console.error("[WEBHOOK:ROUTE] Error processing webhook:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

