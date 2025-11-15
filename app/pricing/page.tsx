"use client";

import { useEffect, useState, Suspense } from "react";
import { StripePricingTable } from "@/components/billing/stripe-pricing-table";
import { useRouter, useSearchParams } from "next/navigation";

// Component that uses useSearchParams - must be wrapped in Suspense
function PricingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Get Stripe Pricing Table ID from environment
  const pricingTableId = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  useEffect(() => {
    // Check for success/cancel from Stripe
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success) {
      // Redirect to billing page after successful payment
      router.push("/billing?success=true");
      return;
    } else if (canceled) {
      // Show cancel message
      console.log("Checkout was canceled");
    }

    // Load customer info and then set loading to false
    loadCustomerInfo().finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCustomerInfo() {
    try {
      const response = await fetch("/api/stripe/customer");
      if (response.ok) {
        const data = await response.json();
        setCustomerId(data.customerId);
        setCustomerEmail(data.customerEmail);
        setUserId(data.userId || null);
      }
    } catch (error) {
      console.error("Error loading customer info:", error);
    }
  }

  // Show error if Stripe Pricing Table is not configured
  if (!pricingTableId || !publishableKey) {
    return (
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Pricing</h1>
            <p className="text-muted-foreground mt-2">
              Choose the plan that's right for you
            </p>
          </div>
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Pricing table is not configured. Please set NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment variables.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Pricing</h1>
            <p className="text-muted-foreground">Choose the plan that's right for you</p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Pricing</h1>
          <p className="text-muted-foreground mt-2">
            Choose the plan that's right for you
          </p>
        </div>

        <div className="flex justify-center">
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
    </div>
  );
}

// Wrapper component that provides Suspense boundary for useSearchParams
export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Pricing</h1>
            <p className="text-muted-foreground">Choose the plan that's right for you</p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    }>
      <PricingPageContent />
    </Suspense>
  );
}

