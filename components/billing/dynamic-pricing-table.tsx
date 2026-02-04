"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [error, setError] = useState<string | null>(null);
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
          const plansData = data.plans || [];
          console.log("[DynamicPricingTable] Plans loaded:", plansData.length, plansData);
          if (plansData.length === 0) {
            setError("No plans available");
          } else {
            setError(null);
          }
          setPlans(plansData.sort((a: Plan, b: Plan) => a.priceMonthly - b.priceMonthly));
        } else {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("[DynamicPricingTable] Error loading plans:", response.status, errorData);
          setError(errorData.error || `Failed to load plans (${response.status})`);
        }
      } catch (error) {
        console.error("[DynamicPricingTable] Error loading plans:", error);
        setError(error instanceof Error ? error.message : "Failed to load plans");
      } finally {
        setLoading(false);
      }
    }
    
    loadPlans();
  }, [currentPlanId, currentInterval]);

  function getPrice(plan: Plan): number {
    return interval === "month" ? plan.priceMonthly : plan.priceYearly;
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

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 ${className || ""}`}>
        <p className="text-destructive mb-2">Error loading plans</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!loading && plans.length === 0) {
    return (
      <div className={`flex items-center justify-center p-6 ${className || ""}`}>
        <p className="text-muted-foreground">No plans available at the moment.</p>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className || ""}`}>
      {/* Interval Toggle */}
      <div className="flex justify-center mb-8">
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

      {/* Plans Grid */}
      {/* Single centered plan card for landing page */}
      <div className="flex justify-center">
        <div className="w-full max-w-lg">
        {plans.map((plan) => {
          // A plan is current only if both planId and interval match
          const isCurrent = plan.id === currentPlanId && interval === currentInterval;
          const price = getPrice(plan);
          const features = getFeatures(plan);
          const monthlyPrice = interval === "year" ? price / 12 : price;

            // Split features into two columns
            const midPoint = Math.ceil(features.length / 2);
            const leftFeatures = features.slice(0, midPoint);
            const rightFeatures = features.slice(midPoint);

          return (
            <Card
              key={plan.id}
                className={`relative w-full ${
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
                      <p className="text-sm text-muted-foreground mt-1">
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
                {/* Features in two columns */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {/* Left column features */}
                  <div className="space-y-2">
                    {leftFeatures.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        {feature.enabled && (
                          <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        )}
                        {!feature.enabled && (
                          <span className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${
                          feature.enabled 
                            ? "text-foreground" 
                            : "text-muted-foreground"
                        }`}>
                          {feature.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Right column features */}
                  <div className="space-y-2">
                    {rightFeatures.map((feature, index) => (
                      <div key={index + midPoint} className="flex items-start gap-2">
                      {feature.enabled && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      )}
                      {!feature.enabled && (
                        <span className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm ${
                        feature.enabled 
                          ? "text-foreground" 
                          : "text-muted-foreground"
                      }`}>
                        {feature.label}
                      </span>
                      </div>
                  ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>
    </div>
  );
}

