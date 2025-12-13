"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { Loader2, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingPricingTableProps {
  currentPlanId?: string;
  currentInterval?: "month" | "year" | null;
  onSelectPlan?: (planId: string, interval: "month" | "year") => void;
  showTrial?: boolean;
  className?: string;
}

export function OnboardingPricingTable({
  currentPlanId,
  currentInterval,
  onSelectPlan,
  showTrial = true,
  className,
}: OnboardingPricingTableProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    async function loadPlans() {
      try {
        setLoading(true);
        const usePublicEndpoint = currentPlanId === undefined && currentInterval === null;
        
        let response;
        if (usePublicEndpoint) {
          response = await fetch("/api/billing/plans/public");
        } else {
          response = await fetch("/api/billing/plans");
          if (!response.ok && response.status === 401) {
            response = await fetch("/api/billing/plans/public");
          }
        }
        
        if (response.ok) {
          const data = await response.json();
          // Only show Pro plan (single plan system)
          const proPlans = (data.plans || []).filter((plan: Plan) => plan.name === 'pro');
          setPlans(proPlans.sort((a: Plan, b: Plan) => a.priceMonthly - b.priceMonthly));
        }
      } catch (error) {
        console.error("Error loading plans:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadPlans();
  }, [currentPlanId, currentInterval]);

  function getPrice(plan: Plan): number {
    return interval === "month" ? plan.priceMonthly : plan.priceYearly;
  }

  function getFeatures(plan: Plan): Array<{ label: string; enabled: boolean; value?: string }> {
    const f = plan.features;
    const features: Array<{ label: string; enabled: boolean; value?: string }> = [];

    // Limits (always shown first) - these have values
    // Transactions / Month
    if (f.maxTransactions === -1) {
      features.push({ label: "Transactions / Month", enabled: true, value: "Unlimited" });
    } else {
      features.push({ label: "Transactions / Month", enabled: true, value: f.maxTransactions.toString() });
    }

    // Bank Accounts
    if (f.maxAccounts === -1) {
      features.push({ label: "Bank Accounts", enabled: true, value: "Unlimited" });
    } else {
      features.push({ label: "Bank Accounts", enabled: true, value: f.maxAccounts.toString() });
    }

    // Features in order of importance (boolean features)
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
      <div className={`flex items-center justify-center p-6 ${className || ""}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Generate feature list based on feature types, not plan values
  const allFeatures: Array<{ label: string; isQuantity: boolean }> = [
    { label: "Transactions / Month", isQuantity: true },
    { label: "Bank Accounts", isQuantity: true },
    { label: "Bank integration", isQuantity: false },
    { label: "Budgets", isQuantity: false },
    { label: "Goals tracking", isQuantity: false },
    { label: "Receipt scanner", isQuantity: false },
    { label: "Investment tracking", isQuantity: false },
    { label: "Advanced reports", isQuantity: false },
    { label: "CSV import", isQuantity: false },
    { label: "CSV export", isQuantity: false },
    { label: "Debt tracking", isQuantity: false },
    { label: "Household members", isQuantity: false },
  ];

  return (
    <div className={`space-y-6 ${className || ""}`}>
      {/* Interval Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border p-1">
          <Button
            type="button"
            variant={interval === "month" ? "default" : "ghost"}
            size="medium"
            onClick={() => setInterval("month")}
            className={interval === "month" ? "shadow-sm" : ""}
          >
            Monthly
          </Button>
          <Button
            type="button"
            variant={interval === "year" ? "default" : "ghost"}
            size="medium"
            onClick={() => setInterval("year")}
            className={interval === "year" ? "shadow-sm" : ""}
          >
            Yearly
            <Badge variant="secondary" className="ml-1 text-xs bg-secondary text-content-primary">
              Save 17%
            </Badge>
          </Button>
        </div>
      </div>

      {/* Plans Grid - Without Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId && interval === currentInterval;
          const price = getPrice(plan);
          const monthlyPrice = interval === "year" ? price / 12 : price;

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative",
                isCurrent && "border-primary shadow-lg"
              )}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                    Current Plan
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl capitalize">{plan.name}</CardTitle>
                <CardDescription>
                  {interval === "year" ? "Billed annually" : "Billed monthly"}
                </CardDescription>
                <div className="mt-4">
                  {interval === "year" ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-foreground">${monthlyPrice.toFixed(2)}</span>
                        <span className="text-muted-foreground text-lg">/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        ${price.toFixed(2)}/year
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-foreground">${price.toFixed(2)}</span>
                      <span className="text-muted-foreground">/month</span>
                    </>
                  )}
                </div>
                <div className="mt-6 pt-4">
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    onClick={() => onSelectPlan?.(plan.id, interval)}
                    disabled={isCurrent}
                  >
                    {isCurrent
                      ? "Current Plan"
                      : showTrial
                      ? "Start 30-day trial"
                      : "Select Plan"}
                  </Button>
                  {!isCurrent && showTrial && (
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      No credit card required
                    </p>
                  )}
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Expand/Collapse Features Button */}
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFeatures(!showFeatures)}
          className="flex items-center gap-2"
        >
          {showFeatures ? "Hide" : "Compare"} features
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            showFeatures && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Features Comparison Table */}
      {showFeatures && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-semibold">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.id} className="text-center p-4 font-semibold capitalize">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatures.map((feature, index) => (
                <tr key={index} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm font-medium">{feature.label}</td>
                  {plans.map((plan) => {
                    const planFeatures = getFeatures(plan);
                    const planFeature = planFeatures.find(f => f.label === feature.label);
                    const isEnabled = planFeature?.enabled ?? false;
                    const hasValue = planFeature?.value !== undefined;
                    
                    return (
                      <td key={plan.id} className="p-4 text-center">
                        {feature.isQuantity ? (
                          hasValue ? (
                            <span className="text-sm font-medium">{planFeature.value}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : isEnabled ? (
                          <Check className="h-5 w-5 text-primary mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

