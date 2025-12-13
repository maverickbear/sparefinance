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
  // Use AuthContext safely - it's available in root layout
  const { isAuthenticated } = useAuthSafe();
  const [selectedPlan, setSelectedPlan] = useState<{ plan: Plan | null; interval: "month" | "year" } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // Debug: Log when component renders
  console.log("[PricingSection] Component rendered", { isAuthenticated });

  async function handleSelectPlan(planId: string, interval: "month" | "year") {
    // Check if user is authenticated
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
        {/* Two Column Layout */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Column - Content */}
          <div className="space-y-6 lg:pr-8">
            <div>
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            Pricing
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            Try Spare Finance free for 30 days.
          </h2>
            </div>
            
            <div className="text-lg text-muted-foreground space-y-4">
              <p className="text-xl font-medium text-foreground">
                Explore every feature.
              </p>
              <p>Build your first budget and see how easy it is to take control of your finances.</p>
              
              <p className="text-xl font-medium text-foreground">
                Add your household if you want.
              </p>
              <p>Share your financial journey with family members and manage money together.</p>
              
              <p className="text-xl font-medium text-foreground">
                Decide later if you want to continue.
              </p>
              <p>No credit card required. Cancel anytime during your free trial.</p>
            </div>

            {/* Additional Benefits */}
            <div className="pt-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Full feature access</p>
                  <p className="text-sm text-muted-foreground">All Pro features unlocked during trial</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">No credit card required</p>
                  <p className="text-sm text-muted-foreground">Start your trial without any payment</p>
          </div>
        </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Cancel anytime</p>
                  <p className="text-sm text-muted-foreground">No commitments, cancel during or after trial</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Pricing Table */}
          <div className="lg:sticky lg:top-8 flex justify-center lg:justify-start">
            <div className="w-full">
            <DynamicPricingTable
              currentPlanId={undefined}
              currentInterval={null}
              onSelectPlan={handleSelectPlan}
              showTrial={true}
            />
            </div>
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

