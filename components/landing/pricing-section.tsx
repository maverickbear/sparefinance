"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicPricingTable } from "@/components/billing/dynamic-pricing-table";
import { EmbeddedCheckout } from "@/components/billing/embedded-checkout";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { useToast } from "@/components/toast-provider";
import { useAuthSafe } from "@/contexts/auth-context";

/**
 * PricingSection
 * 
 * Uses AuthContext for authentication state (single source of truth)
 * Removed business logic - now purely presentation component
 */
export function PricingSection() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useAuthSafe(); // Use Context instead of local state
  const [selectedPlan, setSelectedPlan] = useState<{ plan: Plan | null; interval: "month" | "year" } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  async function handleSelectPlan(planId: string, interval: "month" | "year") {
    // Check if user is authenticated using Context
    if (!isAuthenticated) {
      // Redirect to signup with plan selected
      router.push(`/auth/signup?planId=${planId}&interval=${interval}`);
      return;
    }

    // Load plan details (only if authenticated)
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
    <section id="pricing" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            Pricing
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            Try Spare Finance free for 30 days.
          </h2>
          <div className="text-lg text-muted-foreground max-w-2xl mx-auto space-y-2">
            <p>Explore every feature.</p>
            <p>Build your first budget.</p>
            <p>Add your household if you want.</p>
            <p>Decide later if you want to continue.</p>
          </div>
        </div>

        {/* Dynamic Pricing Table */}
        <div className="max-w-7xl mx-auto flex justify-center">
          <div className="w-full max-w-4xl">
            <DynamicPricingTable
              currentPlanId={undefined}
              currentInterval={null}
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
            router.push("/settings/billing?checkout=success");
          }}
        />
      )}
    </section>
  );
}

