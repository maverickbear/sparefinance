"use client";

import { useEffect, useState, useCallback } from "react";
import { SubscriptionCard } from "@/components/billing/subscription-card";
import { UsageLimits } from "@/components/billing/usage-limits";
import { PlanSelector } from "@/components/billing/plan-selector";
import { Plan, Subscription } from "@/lib/validations/plan";
import { PlanFeatures, LimitCheckResult } from "@/lib/api/limits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [limits, setLimits] = useState<PlanFeatures | null>(null);
  const [transactionLimit, setTransactionLimit] = useState<LimitCheckResult | null>(null);
  const [accountLimit, setAccountLimit] = useState<LimitCheckResult | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>();
  const [selecting, setSelecting] = useState(false);

  const syncSubscription = useCallback(async () => {
    try {
      console.log("[BILLING] Syncing subscription from Stripe...");
      const response = await fetch("/api/stripe/sync-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("[BILLING] Subscription synced successfully:", data.subscription);
        return true;
      } else {
        console.error("[BILLING] Failed to sync subscription:", data.error);
        return false;
      }
    } catch (error) {
      console.error("[BILLING] Error syncing subscription:", error);
      return false;
    }
  }, []);

  useEffect(() => {
    loadBillingData();
    loadPlans();

    // Check for success from Stripe
    const success = searchParams.get("success");
    if (success) {
      // Sync subscription from Stripe and reload billing data after successful payment
      syncSubscription().then((synced) => {
        if (synced) {
          loadBillingData();
          loadPlans();
        }
      });
    }
  }, [searchParams, syncSubscription]);

  async function loadBillingData() {
    try {
      setLoading(true);

      // Get current user subscription
      const subResponse = await fetch("/api/billing/subscription");
      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData.subscription);
        setPlan(subData.plan);
        setLimits(subData.limits);
        setCurrentPlanId(subData.plan?.id);
      }

      // Get usage limits
      const limitsResponse = await fetch("/api/billing/limits");
      if (limitsResponse.ok) {
        const limitsData = await limitsResponse.json();
        setTransactionLimit(limitsData.transactionLimit);
        setAccountLimit(limitsData.accountLimit);
      }
    } catch (error) {
      console.error("Error loading billing data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlans() {
    try {
      // Get plans
      const plansResponse = await fetch("/api/billing/plans");
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.plans);
        if (plansData.currentPlanId) {
          setCurrentPlanId(plansData.currentPlanId);
        }
      }
    } catch (error) {
      console.error("Error loading plans:", error);
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
          // Reload billing data
          await loadBillingData();
          await loadPlans();
          alert("Plan updated successfully!");
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
          body: JSON.stringify({ 
            planId, 
            interval,
            returnUrl: "/billing"
          }),
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
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Billing</h1>
            <p className="text-muted-foreground">Manage your subscription and usage</p>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Manage your subscription and usage</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SubscriptionCard 
            subscription={subscription} 
            plan={plan} 
            onSubscriptionUpdated={loadBillingData}
          />
          {limits && transactionLimit && accountLimit && (
            <UsageLimits
              limits={limits}
              transactionLimit={transactionLimit}
              accountLimit={accountLimit}
            />
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upgrade Plan</CardTitle>
            <CardDescription>Choose a plan that fits your needs. You can upgrade or downgrade at any time.</CardDescription>
          </CardHeader>
          <CardContent>
            {plans.length > 0 ? (
              <PlanSelector
                plans={plans}
                currentPlanId={currentPlanId}
                onSelectPlan={handleSelectPlan}
                loading={selecting}
                showComparison={false}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Loading plans...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

