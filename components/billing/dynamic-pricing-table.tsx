"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { Loader2, Check } from "lucide-react";

interface DynamicPricingTableProps {
  currentPlanId?: string;
  currentInterval?: "month" | "year" | null; // Current subscription interval
  onSelectPlan?: (planId: string, interval: "month" | "year") => void;
  showTrial?: boolean;
  className?: string;
}

export function DynamicPricingTable({
  currentPlanId,
  currentInterval,
  onSelectPlan,
  showTrial = true,
  className,
}: DynamicPricingTableProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<"month" | "year">("month");

  useEffect(() => {
    async function loadPlans() {
      try {
        setLoading(true);
        // If currentPlanId is undefined, user is likely not authenticated
        // Use public endpoint directly to avoid unnecessary auth attempts
        const usePublicEndpoint = currentPlanId === undefined && currentInterval === null;
        
        let response;
        if (usePublicEndpoint) {
          // Use public endpoint directly for unauthenticated users (landing page)
          response = await fetch("/api/billing/plans/public");
        } else {
          // Try authenticated endpoint first (for authenticated users)
          response = await fetch("/api/billing/plans");
          if (!response.ok && response.status === 401) {
            // If 401, fallback to public endpoint
            response = await fetch("/api/billing/plans/public");
          }
        }
        
        if (response.ok) {
          const data = await response.json();
          setPlans((data.plans || []).sort((a: Plan, b: Plan) => a.priceMonthly - b.priceMonthly));
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

  function getFeatures(plan: Plan): string[] {
    const features: string[] = [];
    const f = plan.features;

    if (f.maxTransactions === -1) {
      features.push("Unlimited transactions");
    } else if (f.maxTransactions > 0) {
      features.push(`${f.maxTransactions} transactions/month`);
    }

    if (f.maxAccounts === -1) {
      features.push("Unlimited accounts");
    } else if (f.maxAccounts > 0) {
      features.push(`${f.maxAccounts} accounts`);
    }

    if (f.hasInvestments) features.push("Investment tracking");
    if (f.hasAdvancedReports) features.push("Advanced reports");
    if (f.hasCsvExport) features.push("CSV export");
    if (f.hasCsvImport) features.push("CSV import");
    if (f.hasDebts) features.push("Debt tracking");
    if (f.hasGoals) features.push("Goals tracking");
    if (f.hasBudgets) features.push("Budgets");
    if (f.hasHousehold) features.push("Household members");
    if (f.hasBankIntegration) features.push("Bank integration");

    return features;
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-6 ${className || ""}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`p-6 ${className || ""}`}>
      {/* Interval Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg border p-1 bg-muted">
          <Button
            type="button"
            variant={interval === "month" ? "default" : "ghost"}
            size="small"
            onClick={() => setInterval("month")}
            className={interval === "month" ? "shadow-sm" : ""}
          >
            Monthly
          </Button>
          <Button
            type="button"
            variant={interval === "year" ? "default" : "ghost"}
            size="small"
            onClick={() => setInterval("year")}
            className={interval === "year" ? "shadow-sm" : ""}
          >
            Yearly
            <span className="ml-1 text-xs text-primary">Save 17%</span>
          </Button>
        </div>
      </div>

      {/* Plans Grid */}
      {/* Mobile: 1 column, MD: 2 columns with proper spacing, LG+: 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {plans.map((plan) => {
          // A plan is current only if both planId and interval match
          const isCurrent = plan.id === currentPlanId && interval === currentInterval;
          const price = getPrice(plan);
          const features = getFeatures(plan);
          const monthlyPrice = interval === "year" ? price / 12 : price;

          return (
            <Card
              key={plan.id}
              className={`relative ${
                isCurrent ? "border-primary shadow-lg" : ""
              }`}
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
                      <p className="text-sm text-muted-foreground mt-1 line-through">
                        ${price.toFixed(2)}/year
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-foreground">${price.toFixed(2)}</span>
                      <span className="text-muted-foreground">
                        /month
                      </span>
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
              <CardContent className="!pt-0">
                <ul className="space-y-3">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

