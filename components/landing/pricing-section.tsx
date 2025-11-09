"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlanSelector } from "@/components/billing/plan-selector";
import { Plan } from "@/lib/validations/plan";
import { supabase } from "@/lib/supabase";

export function PricingSection() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      // Use public endpoint that doesn't require authentication
      const response = await fetch("/api/billing/plans/public");
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
      } else {
        console.error("Failed to load plans:", response.statusText);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan(planId: string, interval: "month" | "year") {
    try {
      setSelecting(true);

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to signup with planId
        router.push(`/auth/signup?planId=${planId}&interval=${interval}`);
        return;
      }

      // User is authenticated, proceed with plan selection
      if (planId === "free") {
        // Setup free plan directly
        const response = await fetch("/api/billing/setup-free", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Redirect to dashboard for free plan
          router.push("/dashboard");
        } else {
          console.error("Failed to setup free plan:", data.error);
          alert(data.error || "Failed to setup free plan. Please try again.");
        }
      } else {
        // Create checkout session for paid plans
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planId, interval }),
        });

        const data = await response.json();

        if (data.url) {
          // Redirect to Stripe Checkout
          window.location.href = data.url;
        } else {
          console.error("Failed to create checkout session:", data.error);
          alert("Failed to create checkout session. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error selecting plan:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setSelecting(false);
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-96 bg-muted rounded-[12px]" />
                </div>
              ))}
            </div>
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

        {/* Plan Selector */}
        {plans.length > 0 ? (
          <div className="max-w-7xl mx-auto">
            <PlanSelector
              plans={plans}
              onSelectPlan={handleSelectPlan}
              loading={selecting}
              isPublic={true}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Unable to load plans. Please try again later.</p>
          </div>
        )}
      </div>
    </section>
  );
}

