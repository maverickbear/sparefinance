import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

/**
 * GET /api/stripe/session?session_id=xxx
 * Returns customer email from Stripe checkout session
 * Used to pre-fill signup form for new users
 */

export async function GET(request: NextRequest) {
  noStore();
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    // Retrieve checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Get customer email and name from session
    let customerEmail: string | null = null;
    let customerName: string | null = null;
    let customerId: string | null = null;
    
    if (session.customer) {
      // If customer is a string (ID), retrieve customer details
      if (typeof session.customer === "string") {
        customerId = session.customer;
        const customer = await stripe.customers.retrieve(session.customer);
        if (customer && typeof customer !== "string" && !customer.deleted) {
          customerEmail = customer.email || null;
          customerName = customer.name || null;
        }
      } else {
        // Customer is already expanded
        customerId = session.customer.id;
        if ('email' in session.customer) {
          customerEmail = session.customer.email || null;
        }
        if ('name' in session.customer) {
          customerName = session.customer.name || null;
        }
      }
    } else if (session.customer_email) {
      // Fallback to customer_email from session
      customerEmail = session.customer_email;
    }

    return NextResponse.json({
      customerEmail,
      customerName,
      customerId,
    });
  } catch (error) {
    console.error("[STRIPE/SESSION] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session information" },
      { status: 500 }
    );
  }
}

