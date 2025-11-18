"use client";

import { ReactNode, useState, useEffect } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { PlanFeatures } from "@/lib/validations/plan";
import { Skeleton } from "@/components/ui/skeleton";

interface FeatureGuardProps {
  feature: keyof PlanFeatures;
  children: ReactNode;
  fallback?: ReactNode;
  requiredPlan?: "essential" | "pro";
  featureName?: string;
}

export function FeatureGuard({
  feature,
  children,
  fallback,
  requiredPlan,
  featureName,
}: FeatureGuardProps) {
  const { limits, checking: loading, plan } = useSubscription();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  // Check if user is super_admin
  useEffect(() => {
    async function checkSuperAdmin() {
      try {
        const { getUserRoleClient } = await import("@/lib/api/members-client");
        const role = await getUserRoleClient();
        setIsSuperAdmin(role === "super_admin");
      } catch (error) {
        console.error("Error checking super_admin status:", error);
        setIsSuperAdmin(false);
      }
    }
    checkSuperAdmin();
  }, []);

  if (loading || isSuperAdmin === null) {
    return (
      <div className="space-y-4 md:space-y-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // super_admin has access to all features
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Check feature access directly from the database (via limits)
  // The database is the source of truth - if a feature is disabled in Supabase, it should be disabled here
  // Safety check: convert string "true" to boolean (defensive programming)
  const featureValue = limits[feature];
  const hasAccess = featureValue === true || String(featureValue) === "true";

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // Determine required plan: use provided requiredPlan or infer from feature
    const isProFeature = feature === "hasInvestments" || feature === "hasHousehold" || feature === "hasBankIntegration";
    const requiredPlanName = requiredPlan || (isProFeature ? "pro" : "essential");
    const name = featureName || getFeatureName(feature);
    
    // Get current plan ID for accurate upgrade prompt
    const currentPlanId = plan?.id || "essential";

    return (
      <UpgradePrompt
        feature={name}
        requiredPlan={requiredPlanName}
        currentPlan={currentPlanId}
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
    hasCsvImport: "CSV Import",
    hasDebts: "Debts",
    hasGoals: "Goals",
    hasBankIntegration: "Bank Integration",
    hasHousehold: "Household Members",
    hasBudgets: "Budgets",
  };

  return names[feature] || feature;
}

