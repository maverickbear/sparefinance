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

// Force dynamic rendering - this route uses nextUrl.searchParams
// Note: Using unstable_noStore() instead of export const dynamic due to cacheComponents compatibility

export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/stripe/session/route.ts:23',message:'GET handler entry',data:{hasNoStore:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  noStore();
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/stripe/session/route.ts:30',message:'Before accessing searchParams',data:{requestType:'NextRequest'},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
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
  } catch (error: unknown) {
    // Handle prerendering errors gracefully - these are expected during build analysis
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('prerender') || 
        errorMessage.includes('bail out') ||
        errorMessage.includes('NEXT_PRERENDER_INTERRUPTED')) {
      // During prerendering, return a default response
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }
    
    console.error("[STRIPE/SESSION] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session information" },
      { status: 500 }
    );
  }
}

