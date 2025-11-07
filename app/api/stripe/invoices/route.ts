import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get current user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get subscription to find Stripe customer ID
    const { data: subscription, error: subError } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("userId", authUser.id)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[INVOICES] Error fetching subscription:", subError);
    }

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({
        invoices: [],
        hasMore: false,
        total: 0,
      });
    }

    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const startingAfter = searchParams.get("starting_after") || undefined;

    // Fetch invoices from Stripe
    const params: Stripe.InvoiceListParams = {
      customer: subscription.stripeCustomerId,
      limit: limit + 1, // Fetch one extra to check if there are more
    };

    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    const invoices = await stripe.invoices.list(params);

    // Check if there are more invoices
    const hasMore = invoices.data.length > limit;
    const invoicesToReturn = hasMore ? invoices.data.slice(0, limit) : invoices.data;

    // Format invoices for response
    const formattedInvoices = invoicesToReturn.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      created: invoice.created,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      description: invoice.description || invoice.lines.data[0]?.description || "Subscription payment",
      period_start: invoice.period_start,
      period_end: invoice.period_end,
    }));

    return NextResponse.json({
      invoices: formattedInvoices,
      hasMore,
      total: invoicesToReturn.length,
      nextPage: hasMore && invoicesToReturn.length > 0 ? page + 1 : null,
      lastInvoiceId: hasMore && invoicesToReturn.length > 0 
        ? invoicesToReturn[invoicesToReturn.length - 1].id 
        : null,
    });
  } catch (error) {
    console.error("[INVOICES] Error fetching invoices:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

