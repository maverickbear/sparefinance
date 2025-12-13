"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plan, Subscription } from "@/src/domain/subscriptions/subscriptions.validations";
import { Loader2, Check } from "lucide-react";
import { ChangePlanConfirmationModal } from "@/components/billing/change-plan-confirmation";
import { useToast } from "@/components/toast-provider";

interface PlansGridProps {
  currentPlanId?: string;
  currentInterval?: "month" | "year" | null; // Current subscription interval
  subscription?: Subscription | null;
  onPlanChange?: () => void;
}

export function PlansGrid({ currentPlanId, currentInterval, subscription, onPlanChange }: PlansGridProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      const response = await fetch("/api/billing/plans");
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleUpgrade(planId: string) {
    // Redirect to dashboard with pricing modal
    window.location.href = "/dashboard?openPricingModal=true";
  }

  async function handleDirectPlanChange(plan: Plan) {
    if (!currentPlanId) return;

    const currentPlan = plans.find(p => p.id === currentPlanId);
    if (!currentPlan) return;

    const isUpgrade = plan.priceMonthly > currentPlan.priceMonthly;
    const isDowngrade = plan.priceMonthly < currentPlan.priceMonthly;

    // For upgrades, show confirmation modal (optional, can be skipped)
    // For downgrades, always show confirmation
    if (isDowngrade) {
      setPendingPlan(plan);
      setShowConfirmationModal(true);
      return;
    }

    // For upgrades, proceed directly (or show quick confirmation)
    await processPlanChange(plan, isUpgrade, isDowngrade);
  }

  async function processPlanChange(plan: Plan, isUpgrade: boolean, isDowngrade: boolean) {
    if (!subscription?.stripeSubscriptionId) {
      // No active subscription, need to create one via checkout
      window.location.href = "/dashboard?openPricingModal=true";
      return;
    }

    try {
      setChangingPlanId(plan.id);
      setShowConfirmationModal(false);

      const response = await fetch("/api/stripe/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: plan.id,
          interval: "month",
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: data.message || `Plan ${isUpgrade ? "upgraded" : "downgraded"} successfully`,
          variant: "success",
        });

        if (onPlanChange) {
          onPlanChange();
        }
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to change plan. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error changing plan:", error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChangingPlanId(null);
    }
  }

  async function handleConfirmPlanChange() {
    if (!pendingPlan) return;

    const currentPlan = plans.find(p => p.id === currentPlanId);
    if (!currentPlan) return;

    const isUpgrade = pendingPlan.priceMonthly > currentPlan.priceMonthly;
    const isDowngrade = pendingPlan.priceMonthly < currentPlan.priceMonthly;

    await processPlanChange(pendingPlan, isUpgrade, isDowngrade);
  }


  function getButtonText(plan: Plan, interval: "month" | "year" = "month"): string {
    // A plan is current only if both planId and interval match
    // Note: plans-grid doesn't have interval selector, so we check if it matches currentInterval
    if (plan.id === currentPlanId && interval === currentInterval) {
      return "Current";
    }
    if (plan.priceMonthly === 0) {
      return "Get Started";
    }
    // If user doesn't have a plan (currentPlanId is undefined), show "Start 1-month trial" for paid plans
    if (!currentPlanId && plan.priceMonthly > 0) {
      return "Start 1-month trial";
    }
    // Check if it's an upgrade or downgrade
    const currentPlan = plans.find(p => p.id === currentPlanId);
    if (currentPlan) {
      if (plan.priceMonthly > currentPlan.priceMonthly) {
        return "Upgrade";
      } else if (plan.priceMonthly < currentPlan.priceMonthly) {
        return "Downgrade";
      }
    }
    return "Upgrade";
  }

  function getFeatures(plan: Plan): Array<{ label: string; enabled: boolean }> {
    const f = plan.features;
    const features: Array<{ label: string; enabled: boolean }> = [];

    // Limits (always shown first)
    if (f.maxTransactions === -1) {
      features.push({ label: "Unlimited transactions", enabled: true });
    } else if (f.maxTransactions > 0) {
      features.push({ label: `${f.maxTransactions} transactions/month`, enabled: true });
    }

    if (f.maxAccounts === -1) {
      features.push({ label: "Unlimited accounts", enabled: true });
    } else if (f.maxAccounts > 0) {
      features.push({ label: `${f.maxAccounts} accounts`, enabled: true });
    }

    // Features in order of importance (always shown, enabled based on plan)
    features.push({ label: "Bank integration", enabled: f.hasBankIntegration });
    features.push({ label: "Budgets", enabled: f.hasBudgets });
    features.push({ label: "Goals tracking", enabled: f.hasGoals });
    features.push({ label: "Receipt scanner", enabled: f.hasReceiptScanner });
    features.push({ label: "Investment tracking", enabled: f.hasInvestments });
    features.push({ label: "Advanced reports", enabled: f.hasAdvancedReports });
    features.push({ label: "CSV import", enabled: f.hasCsvImport });
    features.push({ label: "CSV export", enabled: f.hasCsvExport });
    features.push({ label: "Debt tracking", enabled: f.hasDebts });
    features.push({ label: "Household members", enabled: f.hasHousehold });

    return features;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-24"></div>
              <div className="h-4 bg-muted rounded w-32 mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-20"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Only show Pro plan (single plan system)
  const sortedPlans = plans.filter(plan => plan.name === 'pro');

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {sortedPlans.map((plan) => {
          // Note: plans-grid shows monthly prices only, so we check if currentInterval is "month"
          // A plan is current only if both planId and interval match
          const isCurrent = plan.id === currentPlanId && currentInterval === "month";
          const price = plan.priceMonthly;
          const features = getFeatures(plan);
          const buttonText = getButtonText(plan, "month");

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col transition-all border ${
                isCurrent
                  ? "border-primary ring-2 ring-primary/30 shadow-lg"
                  : "border-border"
              }`}
            >

              <CardHeader className="pt-4 pb-3">
                <CardTitle className="text-lg sm:text-xl mb-1">
                  {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                </CardTitle>
                <div className="mt-3 sm:mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-bold">
                      ${price.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground text-xs sm:text-sm">/mo</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 pb-4">
                <ul className="space-y-1">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-1.5">
                      {feature.enabled && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      )}
                      {!feature.enabled && (
                        <span className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-xs ${
                        feature.enabled 
                          ? "text-foreground" 
                          : "text-muted-foreground"
                      }`}>
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-2 pb-4">
                <Button
                  className="w-full"
                  variant={isCurrent ? "secondary" : "default"}
                  disabled={isCurrent || changingPlanId === plan.id}
                  onClick={() => {
                    if (!isCurrent) {
                      // If user has active subscription, try direct change
                      if (subscription?.stripeSubscriptionId) {
                        handleDirectPlanChange(plan);
                      } else {
                        // No subscription, open modal for checkout
                        handleUpgrade(plan.id);
                      }
                    }
                  }}
                >
                  {changingPlanId === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    buttonText
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {pendingPlan && currentPlanId && (
        <ChangePlanConfirmationModal
          open={showConfirmationModal}
          onOpenChange={setShowConfirmationModal}
          currentPlan={plans.find(p => p.id === currentPlanId)!}
          targetPlan={pendingPlan}
          onConfirm={handleConfirmPlanChange}
          loading={changingPlanId === pendingPlan.id}
          isDowngrade={pendingPlan.priceMonthly < (plans.find(p => p.id === currentPlanId)?.priceMonthly || 0)}
          isUpgrade={pendingPlan.priceMonthly > (plans.find(p => p.id === currentPlanId)?.priceMonthly || 0)}
        />
      )}

    </>
  );
}

