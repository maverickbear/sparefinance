"use client";

import { ReactNode } from "react";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { PlanFeatures } from "@/lib/validations/plan";
import { Skeleton } from "@/components/ui/skeleton";

interface FeatureGuardProps {
  feature: keyof PlanFeatures;
  children: ReactNode;
  fallback?: ReactNode;
  requiredPlan?: "basic" | "premium";
  featureName?: string;
}

export function FeatureGuard({
  feature,
  children,
  fallback,
  requiredPlan,
  featureName,
}: FeatureGuardProps) {
  const { limits, loading } = usePlanLimits();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const hasAccess = limits[feature] === true;

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // Determine required plan based on feature
    const plan = requiredPlan || (feature === "hasInvestments" || feature === "hasAdvancedReports" || feature === "hasCsvExport" ? "basic" : "premium");
    const name = featureName || getFeatureName(feature);

    return (
      <UpgradePrompt
        feature={name}
        requiredPlan={plan}
        currentPlan="free"
      />
    );
  }

  return <>{children}</>;
}

function getFeatureName(feature: keyof PlanFeatures): string {
  const names: Record<keyof PlanFeatures, string> = {
    maxTransactions: "Unlimited Transactions",
    maxAccounts: "Unlimited Accounts",
    hasInvestments: "Investments",
    hasAdvancedReports: "Advanced Reports",
    hasCsvExport: "CSV Export",
    hasDebts: "Debts",
    hasGoals: "Goals",
  };

  return names[feature] || feature;
}

