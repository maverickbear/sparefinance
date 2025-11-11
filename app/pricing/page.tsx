"use client";

import { useEffect, useState, Suspense } from "react";
import { PlanSelector } from "@/components/billing/plan-selector";
import { Plan } from "@/lib/validations/plan";
import { useRouter, useSearchParams } from "next/navigation";

// Component that uses useSearchParams - must be wrapped in Suspense
function PricingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>();
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    loadPlans();

    // Check for success/cancel from Stripe
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success) {
      // Redirect to billing page after successful payment
      router.push("/billing?success=true");
    } else if (canceled) {
      // Show cancel message
      console.log("Checkout was canceled");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);

      // Get plans
      const plansResponse = await fetch("/api/billing/plans");
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.plans);
        setCurrentPlanId(plansData.currentPlanId);
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

      // Start trial for paid plans (no Stripe checkout needed)
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

        <PlanSelector
          plans={plans}
          currentPlanId={currentPlanId}
          onSelectPlan={handleSelectPlan}
          loading={selecting}
        />
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

