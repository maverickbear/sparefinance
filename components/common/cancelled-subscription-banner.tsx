"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, RotateCcw, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSubscriptionSafe } from "@/contexts/subscription-context";
import { useToast } from "@/components/toast-provider";
import { cn } from "@/lib/utils";
import type { Subscription } from "@/lib/validations/plan";

interface CancelledSubscriptionBannerProps {
  isSidebarCollapsed?: boolean;
}

export function CancelledSubscriptionBanner({ isSidebarCollapsed = false }: CancelledSubscriptionBannerProps) {
  const contextData = useSubscriptionSafe();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(contextData.subscription);
  const [checking, setChecking] = useState(contextData.checking);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Fetch subscription from API if context doesn't have it
  useEffect(() => {
    // If context has subscription, use it
    if (contextData.subscription) {
      setSubscription(contextData.subscription);
      setChecking(contextData.checking);
      return;
    }

    // Otherwise, fetch from API
    async function fetchSubscription() {
      setChecking(true);
      try {
        const response = await fetch("/api/billing/subscription");
        if (response.ok) {
          const data = await response.json();
          setSubscription(data.subscription);
        }
      } catch (error) {
        console.error("[CANCELLED-BANNER] Error fetching subscription:", error);
      } finally {
        setChecking(false);
      }
    }

    fetchSubscription();
  }, [contextData.subscription, contextData.checking]);

  // Only show banner when subscription is fully cancelled
  // Check both status === "cancelled" and also handle case-insensitive comparison
  // Also check for null/undefined status
  const status = subscription?.status;
  const statusString = status ? String(status).toLowerCase().trim() : "";
  const isFullyCancelled = statusString === "cancelled";

  // No need to update CSS variable since banner is now in content flow

  // Debug logging - always log
  useEffect(() => {
    console.log('[CANCELLED-BANNER] Subscription status check:', {
      hasSubscription: !!subscription,
      subscriptionId: subscription?.id,
      status: status,
      statusString: statusString,
      statusType: typeof status,
      isFullyCancelled,
      checking,
      fromContext: !!contextData.subscription,
      fullSubscription: JSON.stringify(subscription, null, 2),
    });
  }, [subscription, status, statusString, isFullyCancelled, checking, contextData.subscription]);

  // No need to update CSS variable since banner is now in content flow

  // Don't render if subscription is still loading
  if (checking) {
    console.log('[CANCELLED-BANNER] Still checking, not rendering');
    return null;
  }

  // Only show banner when subscription is fully cancelled
  if (!isFullyCancelled) {
    console.log('[CANCELLED-BANNER] Not cancelled, not rendering. Status:', status, 'StatusString:', statusString);
    return null;
  }

  console.log('[CANCELLED-BANNER] RENDERING BANNER - Subscription is cancelled!');

  async function handleReactivate() {
    try {
      setLoading(true);
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to open Stripe portal",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast({
        title: "Error",
        description: "Failed to open Stripe portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Alert
      ref={bannerRef}
      variant="default"
      className={cn(
        "w-full rounded-none border-0",
        "bg-purple-100 dark:bg-purple-900/30",
        "text-black dark:text-white"
      )}
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <span className="flex-1 min-w-0">
          <strong>Subscription Cancelled:</strong> You can still view your data, but changes are disabled for now. Reactivate anytime to get full access back.
        </span>
        <Button
          onClick={handleReactivate}
          disabled={loading}
          variant="default"
          size="small"
          className="shrink-0 w-full lg:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reactivate Subscription
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

