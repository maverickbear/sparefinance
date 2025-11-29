"use client";

import { useEffect, Suspense, useState } from "react";
import { DynamicPricingTable } from "@/components/billing/dynamic-pricing-table";
import { EmbeddedCheckout } from "@/components/billing/embedded-checkout";
import { useRouter, useSearchParams } from "next/navigation";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { useToast } from "@/components/toast-provider";

// Component that uses useSearchParams - must be wrapped in Suspense
function PricingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<{ plan: Plan | null; interval: "month" | "year" } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>(undefined);
  const [currentInterval, setCurrentInterval] = useState<"month" | "year" | null>(null);

  useEffect(() => {
    // Check authentication and load current plan info
    async function checkAuth() {
      try {
        // Try to access subscription endpoint (requires auth)
        const response = await fetch("/api/billing/subscription");
        setIsAuthenticated(response.ok);
        
        // Also fetch plans to get currentPlanId and currentInterval
        const plansResponse = await fetch("/api/billing/plans");
        if (plansResponse.ok) {
          const plansData = await plansResponse.json();
          setCurrentPlanId(plansData.currentPlanId);
          setCurrentInterval(plansData.currentInterval);
        }
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkAuth();

    // Check for success/cancel from Stripe
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success) {
      toast({
        title: "Success",
        description: "Subscription created successfully!",
        variant: "success",
      });
      router.push("/settings?tab=billing");
      return;
    } else if (canceled) {
      toast({
        title: "Cancelled",
        description: "Checkout was cancelled",
        variant: "default",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelectPlan(planId: string, interval: "month" | "year") {
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Redirect to signup with plan selected
      router.push(`/auth/signup?planId=${planId}&interval=${interval}`);
      return;
    }

    // Load plan details
    try {
      const response = await fetch("/api/billing/plans");
      if (response.ok) {
        const data = await response.json();
        const plan = (data.plans || []).find((p: Plan) => p.id === planId);
        if (plan) {
          setSelectedPlan({ plan, interval });
          setShowCheckout(true);
        }
      }
    } catch (error) {
      console.error("Error loading plan:", error);
      toast({
        title: "Error",
        description: "Failed to load plan details. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="container mx-auto py-8 bg-background">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Pricing</h1>
          <p className="text-muted-foreground mt-2">
            Choose the plan that's right for you. Start your 30-day free trial today.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-4xl">
            <DynamicPricingTable
              currentPlanId={currentPlanId}
              currentInterval={currentInterval}
              onSelectPlan={handleSelectPlan}
              showTrial={true}
            />
          </div>
        </div>
      </div>

      {selectedPlan?.plan && (
        <EmbeddedCheckout
          open={showCheckout}
          onOpenChange={(open) => {
            setShowCheckout(open);
            if (!open) {
              setSelectedPlan(null);
            }
          }}
          plan={selectedPlan.plan}
          interval={selectedPlan.interval}
          onSuccess={() => {
            setShowCheckout(false);
            setSelectedPlan(null);
            router.push("/settings?tab=billing&checkout=success");
          }}
        />
      )}
    </div>
  );
}

// Wrapper component that provides Suspense boundary for useSearchParams
export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8 bg-background">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pricing</h1>
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

