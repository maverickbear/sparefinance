"use client";

import { ReactNode } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockedFeature } from "./blocked-feature";
import { PageHeader } from "./page-header";
import { useAuthSafe } from "@/contexts/auth-context";

interface FeatureGuardProps {
  feature: keyof PlanFeatures;
  children: ReactNode;
  fallback?: ReactNode;
  requiredPlan?: "essential" | "pro";
  featureName?: string;
  header?: ReactNode;
  headerTitle?: string;
}

/**
 * FeatureGuard
 * 
 * Uses AuthContext and SubscriptionContext for user data (single source of truth)
 * No longer makes direct API calls - all data comes from Context
 */
export function FeatureGuard({
  feature,
  children,
  fallback,
  requiredPlan,
  featureName,
  header,
  headerTitle,
}: FeatureGuardProps) {
  const { limits, checking: loading, plan } = useSubscription();
  const { role, checking: checkingAuth } = useAuthSafe(); // Use Context instead of fetch
  
  // Derive isSuperAdmin from Context role
  const isSuperAdmin = role === "super_admin";
  const checkingSuperAdmin = checkingAuth;

  // OPTIMIZATION: Don't block render while checking
  // Show content optimistically, checks happen in background
  if (loading || checkingSuperAdmin) {
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

    // Feature not available - show blocked screen
    const displayName = featureName || getFeatureName(feature);
    return (
      <>
        {/* Show only title when blocked */}
        {headerTitle ? (
          <PageHeader title={headerTitle} />
        ) : header ? (
          // Try to extract title from header if headerTitle not provided
          header
        ) : null}
        <BlockedFeature feature={feature} featureName={displayName} />
      </>
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
    hasReceiptScanner: "Receipt Scanner",
  };

  return names[feature] || feature;
}

