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
      const response = await fetch("/api/billing/plans");
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
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
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Our pricing plans
            </h2>
            <p className="text-lg text-muted-foreground">
              Discover your ultimate finance management solution for individuals, startups, and enterprises
            </p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-64 bg-muted rounded-[12px]" />
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
            Our pricing plans
          </h2>
          <p className="text-lg text-muted-foreground">
            Discover your ultimate finance management solution for individuals, startups, and enterprises
          </p>
        </div>

        {/* Plan Selector */}
        <PlanSelector
          plans={plans}
          onSelectPlan={handleSelectPlan}
          loading={selecting}
        />
      </div>
    </section>
  );
}

