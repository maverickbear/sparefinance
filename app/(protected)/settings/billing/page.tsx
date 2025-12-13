"use client";

import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/common/page-header";
import { UsageChart } from "@/components/billing/usage-chart";
import { SubscriptionManagementEmbedded } from "@/components/billing/subscription-management-embedded";
import { PaymentMethodManager } from "@/components/billing/payment-method-manager";
import { Subscription, Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";
import { BaseLimitCheckResult } from "@/src/domain/subscriptions/subscriptions.types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Lazy load PaymentHistory to improve initial load time
const PaymentHistory = lazy(() => 
  import("@/components/billing/payment-history").then(m => ({ default: m.PaymentHistory }))
);

function LazyPaymentHistory() {
  return (
    <Suspense fallback={
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    }>
      <PaymentHistory />
    </Suspense>
  );
}

export default function BillingPage() {
  const perf = usePagePerformance("Settings - Billing");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [limits, setLimits] = useState<PlanFeatures | null>(null);
  const [transactionLimit, setTransactionLimit] = useState<BaseLimitCheckResult | null>(null);
  const [accountLimit, setAccountLimit] = useState<BaseLimitCheckResult | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year" | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  // OPTIMIZED: Share household info between components to avoid duplicate calls
  const [householdInfo, setHouseholdInfo] = useState<{ isOwner: boolean; isMember: boolean; ownerId?: string; ownerName?: string } | null>(null);

  const syncSubscription = useCallback(async () => {
    try {
      setSyncing(true);
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
        
        toast({
          title: "Subscription Updated",
          description: "Your subscription has been updated successfully.",
        });
        return true;
      } else {
        console.error("[BILLING] Failed to sync subscription:", data.error);
        return false;
      }
    } catch (error) {
      console.error("[BILLING] Error syncing subscription:", error);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [toast]);

  const loadBillingData = useCallback(async (force = false) => {
    // Don't reload if already loaded and not forced
    if (hasLoaded && !syncing && !force) {
      return;
    }

    try {
      setLoading(true);
      
      // Single API call that returns everything (subscription, plan, limits, transactionLimit, accountLimit)
      const subResponse = await fetch("/api/v2/billing/subscription", {
        cache: "no-store",
      });
      
      if (!subResponse.ok) {
        console.error("Failed to fetch subscription:", subResponse.status);
        setSubscription(null);
        setPlan(null);
        setLimits(null);
        setTransactionLimit(null);
        setAccountLimit(null);
        setBillingInterval(null);
        setHasLoaded(true);
        return;
      }

      const subData = await subResponse.json();
      const result = {
        subscription: subData.subscription ?? null,
        plan: subData.plan ?? null,
        limits: subData.limits ?? null,
        transactionLimit: subData.transactionLimit ?? null,
        accountLimit: subData.accountLimit ?? null,
        interval: subData.interval ?? null,
      };

      // Update state
      setSubscription(result.subscription);
      setPlan(result.plan);
      setLimits(result.limits);
      setTransactionLimit(result.transactionLimit);
      setAccountLimit(result.accountLimit);
      setBillingInterval(result.interval);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error loading billing data:", error);
    } finally {
      setLoading(false);
    }
  }, [hasLoaded, syncing]);
  
  // Mark as loaded when component mounts (page structure is ready)
  useEffect(() => {
    const timer = setTimeout(() => {
      perf.markComplete();
    }, 100);
    return () => clearTimeout(timer);
  }, [perf]);

  // Check if user is returning from Stripe Portal
  useEffect(() => {
    const portalReturn = searchParams.get("portal_return");
    if (portalReturn === "true") {
      // Redirect to billing page
      router.replace("/settings/billing", { scroll: false });
      // Force reload after sync
      setHasLoaded(false);
      // Sync subscription from Stripe
      syncSubscription().then(() => {
        // Reload billing data after sync
        loadBillingData(true);
      });
    }
  }, [searchParams, router, syncSubscription, loadBillingData]);

  // OPTIMIZED: Load household info once and share between components
  useEffect(() => {
    async function loadHouseholdInfo() {
      try {
        const response = await fetch("/api/v2/household/info");
        if (response.ok) {
          const data = await response.json();
          setHouseholdInfo(data);
        }
      } catch (error) {
        console.error("Error loading household info:", error);
      }
    }
    loadHouseholdInfo();
  }, []);

  // Load data on mount immediately
  useEffect(() => {
    if (!hasLoaded) {
      loadBillingData();
    }
  }, [hasLoaded, loadBillingData]);

  // Refresh billing data periodically when billing page is active
  useEffect(() => {
    // Refresh data every 30 seconds when billing page is active
    const interval = setInterval(() => {
      loadBillingData(true); // Force refresh
    }, 30000); // 30 seconds

    // Also refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadBillingData(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadBillingData]);

  return (
    <div>
      <PageHeader
        title="Billing"
      />

      <div className="w-full p-4 lg:p-8">
        <div className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <SubscriptionManagementEmbedded
          subscription={subscription}
          plan={plan}
          interval={billingInterval}
          householdInfo={householdInfo}
          onSubscriptionUpdated={() => {
            loadBillingData(true);
          }}
        />

        <UsageChart
          limits={limits ?? undefined}
          transactionLimit={transactionLimit ?? undefined}
          accountLimit={accountLimit ?? undefined}
        />
      </div>

          <PaymentMethodManager />

          <LazyPaymentHistory />
        </div>
      </div>
    </div>
  );
}

