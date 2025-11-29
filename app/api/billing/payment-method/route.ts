import { NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export async function GET() {
  try {
    const supabase = await createServerClient();
    
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
      console.error("[PAYMENT_METHOD] Error fetching subscription:", subError);
    }

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({
        paymentMethod: null,
      });
    }

    // Get customer's default payment method
    const customer = await stripe.customers.retrieve(subscription.stripeCustomerId);
    
    if (customer.deleted) {
      return NextResponse.json({
        paymentMethod: null,
      });
    }

    const customerId = typeof customer === "string" ? customer : customer.id;
    const defaultPaymentMethodId = typeof customer === "object" && customer.invoice_settings?.default_payment_method;

    if (!defaultPaymentMethodId) {
      // Try to get payment methods attached to customer
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      });

      if (paymentMethods.data.length === 0) {
        return NextResponse.json({
          paymentMethod: null,
        });
      }

      const paymentMethod = paymentMethods.data[0];
      return NextResponse.json({
        paymentMethod: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          card: paymentMethod.card ? {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            expMonth: paymentMethod.card.exp_month,
            expYear: paymentMethod.card.exp_year,
          } : null,
        },
      });
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId as string);

    return NextResponse.json({
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
        } : null,
      },
    });
  } catch (error) {
    console.error("[PAYMENT_METHOD] Error fetching payment method:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment method" },
      { status: 500 }
    );
  }
}

