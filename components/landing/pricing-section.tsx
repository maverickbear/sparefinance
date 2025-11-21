"use client";

import { StripePricingTable } from "@/components/billing/stripe-pricing-table";

export function PricingSection() {

  return (
    <section id="pricing" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            Pricing
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            Try For Free And<br />Start Controlling Your Finances
          </h2>
        </div>

        {/* Stripe Pricing Table */}
        <div className="max-w-7xl mx-auto flex justify-center">
          <div className="w-full max-w-4xl">
            <StripePricingTable />
          </div>
        </div>
      </div>
    </section>
  );
}

