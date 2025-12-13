"use client";

import { useEffect, useState } from "react";
import { OnboardingPricingTable } from "./onboarding-pricing-table";
import { useToast } from "@/components/toast-provider";

interface PlanSelectionStepProps {
  onPlanSelected?: (planId: string, interval: "month" | "year") => void;
  currentPlanId?: string;
  currentInterval?: "month" | "year" | null;
  selectedPlanId?: string;
  selectedInterval?: "month" | "year" | null;
}

export function PlanSelectionStep({ 
  onPlanSelected, 
  currentPlanId, 
  currentInterval,
  selectedPlanId,
  selectedInterval
}: PlanSelectionStepProps) {
  const { toast } = useToast();
  const [autoSelected, setAutoSelected] = useState(false);

  // Auto-select Pro plan if user doesn't have a plan yet
  useEffect(() => {
    if (!currentPlanId && !selectedPlanId && !autoSelected && onPlanSelected) {
      // Fetch plans to get Pro plan ID
      fetch("/api/billing/plans")
        .then(res => res.ok ? res.json() : fetch("/api/billing/plans/public").then(r => r.json()))
        .then(data => {
          const proPlan = (data.plans || []).find((p: any) => p.name === 'pro');
          if (proPlan) {
            // Auto-select Pro plan with monthly interval
            onPlanSelected(proPlan.id, "month");
            setAutoSelected(true);
          }
        })
        .catch(err => {
          console.error("Error auto-selecting plan:", err);
        });
    }
  }, [currentPlanId, selectedPlanId, autoSelected, onPlanSelected]);

  function handleSelectPlan(planId: string, interval: "month" | "year") {
    // Just store the selection, don't create subscription yet
    if (onPlanSelected) {
      onPlanSelected(planId, interval);
    }
  }

  // Check if user already has a plan
  const hasPlan = currentPlanId && currentInterval;
  // Use selected plan if available, otherwise use current plan
  const displayPlanId = selectedPlanId || currentPlanId;
  const displayInterval = selectedInterval || currentInterval;

  return (
    <div className="space-y-4">
      {hasPlan && !selectedPlanId ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            You already have a plan selected. You can change it in settings.
          </p>
        </div>
      ) : (
        <OnboardingPricingTable
          currentPlanId={displayPlanId}
          currentInterval={displayInterval}
          onSelectPlan={handleSelectPlan}
          showTrial={true}
        />
      )}
    </div>
  );
}

