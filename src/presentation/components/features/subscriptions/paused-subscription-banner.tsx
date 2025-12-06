"use client";

import { useState, useEffect } from "react";
import { Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSubscriptionSafe } from "@/contexts/subscription-context";
import { cn } from "@/lib/utils";

interface PausedSubscriptionBannerProps {
  isSidebarCollapsed?: boolean;
}

export function PausedSubscriptionBanner({ isSidebarCollapsed = false }: PausedSubscriptionBannerProps) {
  const contextData = useSubscriptionSafe();
  const [isPaused, setIsPaused] = useState(false);
  const [pausedReason, setPausedReason] = useState<string | null>(null);
  const [checkingPauseStatus, setCheckingPauseStatus] = useState(false);

  // Check if subscription is paused
  useEffect(() => {
    async function checkPauseStatus() {
      setCheckingPauseStatus(true);
      try {
        const response = await fetch("/api/v2/subscriptions/pause-status");
        if (response.ok) {
          const data = await response.json();
          setIsPaused(data.isPaused || false);
          setPausedReason(data.pausedReason || null);
        }
      } catch (error) {
        console.error("[PAUSED-BANNER] Error checking pause status:", error);
      } finally {
        setCheckingPauseStatus(false);
      }
    }

    // Only check if we have a subscription context
    if (contextData.subscription) {
      checkPauseStatus();
    }
  }, [contextData.subscription]);

  // Don't render if subscription is still loading or checking pause status
  if (contextData.checking || checkingPauseStatus) {
    return null;
  }

  // Only show banner when subscription is paused due to household membership
  if (!isPaused || pausedReason !== "household_member") {
    return null;
  }

  return (
    <Alert
      variant="default"
      className={cn(
        "w-full rounded-none border-0",
        "bg-blue-50 dark:bg-blue-900/20",
        "border-blue-200 dark:border-blue-800",
        "text-foreground"
      )}
    >
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="flex flex-col gap-2">
        <span className="flex-1 min-w-0">
          <strong>Subscription Paused:</strong> Your personal subscription is currently paused because you're using your household's subscription. Your subscription will automatically resume if you leave the household.
        </span>
      </AlertDescription>
    </Alert>
  );
}

