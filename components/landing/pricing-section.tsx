"use client";

import { useState, useEffect } from "react";
import { StripePricingTable } from "@/components/billing/stripe-pricing-table";

export function PricingSection() {
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Get Stripe Pricing Table ID from environment
  const pricingTableId = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  useEffect(() => {
    loadCustomerInfo();
    setLoading(false);
  }, []);

  async function loadCustomerInfo() {
    try {
      const response = await fetch("/api/stripe/customer");
      if (response.ok) {
        const data = await response.json();
        setCustomerId(data.customerId);
        setCustomerEmail(data.customerEmail);
        setUserId(data.userId || null);
      } else if (response.status === 401) {
        // User is not authenticated - this is fine for public landing page
        // Pricing table will work without customer info
      }
    } catch (error) {
      // Silently fail - customer info is optional for public pricing section
      // Pricing table works fine without customer info (it will just not pre-fill)
    }
  }

  if (loading) {
    return (
      <section id="pricing" className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free forever. Upgrade when you're ready for advanced features like bank integration, unlimited transactions, and family sharing.
            </p>
          </div>
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-96 bg-muted rounded-[12px]" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // If Stripe Pricing Table is not configured, show a link to pricing page
  if (!pricingTableId || !publishableKey) {
    return (
      <section id="pricing" className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free forever. Upgrade when you're ready for advanced features like bank integration, unlimited transactions, and family sharing.
            </p>
          </div>
          <div className="text-center py-12">
            <a href="/pricing" className="text-primary hover:underline">
              View pricing plans →
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free forever. Upgrade when you're ready for advanced features like bank integration, unlimited transactions, and family sharing.
          </p>
        </div>

        {/* Stripe Pricing Table */}
        <div className="max-w-7xl mx-auto flex justify-center">
          <div className="w-full max-w-4xl">
            <StripePricingTable
              pricingTableId={pricingTableId}
              publishableKey={publishableKey}
              customerId={customerId || undefined}
              customerEmail={customerEmail || undefined}
              clientReferenceId={userId || undefined}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

