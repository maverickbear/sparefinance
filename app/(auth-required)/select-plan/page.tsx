"use client";

import { useEffect, useState, Suspense } from "react";
import { PlanSelector } from "@/components/billing/plan-selector";
import { Plan } from "@/lib/validations/plan";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function SelectPlanPageContent() {
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

      // Start trial without going to Stripe
      const response = await fetch("/api/billing/start-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Trial started successfully, redirect to dashboard
        router.push("/dashboard");
      } else {
        console.error("Failed to start trial:", data.error);
        alert(data.error || "Failed to start trial. Please try again.");
      }
    } catch (error) {
      console.error("Error starting trial:", error);
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

export default function SelectPlanPage() {
  return (
    <Suspense fallback={
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
    }>
      <SelectPlanPageContent />
    </Suspense>
  );
}

