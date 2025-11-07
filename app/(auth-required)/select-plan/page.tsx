"use client";

import { useEffect, useState } from "react";
import { PlanSelector } from "@/components/billing/plan-selector";
import { Plan } from "@/lib/validations/plan";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SelectPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);

      // Get plans
      const plansResponse = await fetch("/api/billing/plans");
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.plans);
        
        // If user already has an active plan, redirect to dashboard
        if (plansData.currentPlanId) {
          console.log("[SELECT-PLAN] User already has active plan:", plansData.currentPlanId);
          router.push("/dashboard");
          return;
        }
      } else if (plansResponse.status === 401) {
        // User is not authenticated, redirect to login
        console.log("[SELECT-PLAN] User not authenticated, redirecting to login");
        router.push("/auth/login?redirect=/select-plan");
        return;
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
          // Redirect to welcome page for free plan
          router.push("/welcome?plan=free");
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
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Choose Your Plan</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Select a plan to get started
            </p>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select a plan to get started with your financial management. You can upgrade or downgrade at any time.
          </p>
        </div>

        <PlanSelector
          plans={plans}
          onSelectPlan={handleSelectPlan}
          loading={selecting}
          showComparison={false}
        />
      </div>
    </div>
  );
}

