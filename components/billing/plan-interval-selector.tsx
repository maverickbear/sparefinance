"use client";

import { useState, useEffect } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanIntervalSelectorProps {
  currentPlanId?: string;
  currentInterval?: "month" | "year" | null;
  onSelectPlan?: (planId: string, interval: "month" | "year") => void;
  showTrial?: boolean;
  className?: string;
}

export function PlanIntervalSelector({
  currentPlanId,
  currentInterval,
  onSelectPlan,
  showTrial = true,
  className,
}: PlanIntervalSelectorProps) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<"month" | "year">("year");

  useEffect(() => {
    async function loadPlans() {
      try {
        setLoading(true);
        const usePublicEndpoint = currentPlanId === undefined && currentInterval === null;
        let response: Response;
        if (usePublicEndpoint) {
          response = await fetch("/api/billing/plans/public");
        } else {
          response = await fetch("/api/billing/plans");
          if (!response.ok && response.status === 401) {
            response = await fetch("/api/billing/plans/public");
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          setError(errorData.error || "Failed to load plans");
          setPlan(null);
          return;
        }

        const data = await response.json();
        const plansData = (data.plans || []) as Plan[];
        if (plansData.length === 0) {
          setError("No plans available");
          setPlan(null);
        } else {
          setError(null);
          setPlan(plansData.sort((a: Plan, b: Plan) => a.priceMonthly - b.priceMonthly)[0]);
        }
      } catch (err) {
        console.error("[PlanIntervalSelector] Error loading plans:", err);
        setError(err instanceof Error ? err.message : "Failed to load plans");
        setPlan(null);
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
  }, [currentPlanId, currentInterval]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-6", className)}>
        <p className="text-destructive mb-2">Error loading plans</p>
        <p className="text-sm text-muted-foreground">{error || "No plans available."}</p>
      </div>
    );
  }

  const priceMonthly = plan.priceMonthly;
  const priceYearly = plan.priceYearly;
  const yearlyMonthlyEquivalent = priceYearly / 12;
  const isCurrentMonthly = currentPlanId === plan.id && currentInterval === "month";
  const isCurrentYearly = currentPlanId === plan.id && currentInterval === "year";

  const selectedPrice = selectedInterval === "month" ? priceMonthly : priceYearly;
  const selectedLabel = selectedInterval === "month" ? `$${priceMonthly.toFixed(2)}/month` : `$${priceYearly.toFixed(2)}/year`;
  const currentLabel =
    currentInterval === "month"
      ? `$${priceMonthly.toFixed(2)}/month`
      : currentInterval === "year"
        ? `$${priceYearly.toFixed(2)}/year`
        : null;

  function handleSubmit() {
    onSelectPlan?.(plan.id, selectedInterval);
  }

  return (
    <div className={cn("space-y-8 pt-2", className)}>
      {/* Monthly / Yearly cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Card
          role="button"
          tabIndex={0}
          onClick={() => setSelectedInterval("month")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedInterval("month")}
          className={cn(
            "cursor-pointer transition-colors",
            selectedInterval === "month"
              ? "border-primary bg-primary/5 ring-2 ring-primary"
              : "border-border hover:border-muted-foreground/50"
          )}
        >
          <CardHeader className="p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold">Monthly</CardTitle>
              {isCurrentMonthly && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Current
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0">Billed every month</CardDescription>
            <p className="text-2xl font-bold text-foreground pt-1">${priceMonthly.toFixed(2)}/month</p>
          </CardHeader>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => setSelectedInterval("year")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedInterval("year")}
          className={cn(
            "cursor-pointer transition-colors",
            selectedInterval === "year"
              ? "border-primary bg-primary/5 ring-2 ring-primary"
              : "border-border hover:border-muted-foreground/50"
          )}
        >
          <CardHeader className="p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold">Yearly</CardTitle>
              {isCurrentYearly ? (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Current
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary shrink-0 px-2">
                  Save 17%
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0">Billed annually</CardDescription>
            <div className="space-y-1 pt-1">
              <p className="text-2xl font-bold text-foreground">${priceYearly.toFixed(2)}/year</p>
              <p className="text-sm text-muted-foreground">${yearlyMonthlyEquivalent.toFixed(2)}/month</p>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border bg-muted/30 p-5 sm:p-6 space-y-4">
        <h4 className="font-semibold text-sm">Summary</h4>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">New plan</span>
          <span className="font-medium text-foreground">{selectedLabel}</span>
        </div>
        {currentLabel && (
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Current plan</span>
            <span>{currentLabel}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-sm font-semibold pt-4 border-t border-border">
          <span>Total</span>
          <span>{selectedLabel}</span>
        </div>
      </div>

      {/* Action */}
      <div className="space-y-4">
        <Button
          className="w-full sm:w-auto min-w-[160px]"
          onClick={handleSubmit}
        >
          {showTrial ? "Start 30-day trial" : "Select plan"}
        </Button>
        {showTrial && (
          <p className="text-sm text-muted-foreground pb-2">
            You'll only be charged after your trial ends. Cancel anytime.
          </p>
        )}
      </div>
    </div>
  );
}
