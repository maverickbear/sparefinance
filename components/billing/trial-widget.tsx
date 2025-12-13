"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TrialWidgetProps {
  daysRemaining: number;
  progress: number;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  onUpgrade?: () => void;
  planName?: string | null;
}

export function calculateTrialDaysRemaining(trialEndDate: string | null | undefined): number {
  if (!trialEndDate) return 0;
  const endDate = new Date(trialEndDate);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function calculateTrialProgress(
  trialStartDate: string | null | undefined, 
  trialEndDate: string | null | undefined,
  daysRemaining?: number
): number {
  if (!trialEndDate) return 0;
  
  const endDate = new Date(trialEndDate);
  const now = new Date();
  
  // Validate end date
  if (isNaN(endDate.getTime())) {
    return 0;
  }
  
  // Calculate remaining time
  const remainingTime = endDate.getTime() - now.getTime();
  
  // If trial has already ended, return 0
  if (remainingTime <= 0) return 0;
  
  let totalDuration: number;
  
  if (trialStartDate) {
    // If we have start date, use it to calculate total duration
    const startDate = new Date(trialStartDate);
    if (isNaN(startDate.getTime())) {
      return 0;
    }
    totalDuration = endDate.getTime() - startDate.getTime();
  } else if (daysRemaining !== undefined && daysRemaining > 0) {
    // If we don't have start date but have days remaining, estimate total duration
    // Calculate elapsed time from now to end date, then estimate total
    // We know: remainingTime = time from now to end
    // We need: totalDuration = time from start to end
    // Estimate: if we have daysRemaining, we can estimate elapsed days
    // Common trial periods: 7, 14, 30 days. Use daysRemaining to estimate.
    // If daysRemaining is high (e.g., 25), trial is likely 30 days
    // If daysRemaining is medium (e.g., 10-20), trial is likely 14 days  
    // If daysRemaining is low (e.g., <10), trial is likely 7 days
    let estimatedTotalDays: number;
    if (daysRemaining >= 20) {
      estimatedTotalDays = 30; // Likely a 30-day trial
    } else if (daysRemaining >= 5) {
      estimatedTotalDays = 14; // Likely a 14-day trial
    } else {
      estimatedTotalDays = 7; // Likely a 7-day trial
    }
    
    // Calculate elapsed days (estimated)
    const elapsedDays = estimatedTotalDays - daysRemaining;
    // Use the actual remaining time and add estimated elapsed time
    totalDuration = remainingTime + (elapsedDays * 24 * 60 * 60 * 1000);
  } else {
    // Fallback: assume 14-day trial period
    totalDuration = 14 * 24 * 60 * 60 * 1000;
  }
  
  if (totalDuration <= 0) return 0;
  
  // Calculate progress as percentage of remaining time
  // This way the slider starts at 100% and decreases as days pass
  const progress = (remainingTime / totalDuration) * 100;
  
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  // Return 0 if result is invalid
  return isNaN(clampedProgress) ? 0 : clampedProgress;
}

export function TrialWidget({ 
  daysRemaining, 
  progress: initialProgress,
  trialStartDate,
  trialEndDate,
  onUpgrade,
  planName 
}: TrialWidgetProps) {
  const router = useRouter();

  // Calculate initial progress value
  const getInitialProgress = (): number => {
    if (trialEndDate) {
      const calculated = calculateTrialProgress(trialStartDate, trialEndDate, daysRemaining);
      // Use calculated value if it's valid (even if 0)
      if (!isNaN(calculated)) {
        return calculated;
      }
    }
    // Fallback to initialProgress if dates are not available or calculation fails
    return initialProgress || 0;
  };

  const [currentProgress, setCurrentProgress] = useState(getInitialProgress());

  // Update progress dynamically
  useEffect(() => {
    const updateProgress = () => {
      if (trialEndDate) {
        const calculated = calculateTrialProgress(trialStartDate, trialEndDate, daysRemaining);
        // Use calculated value if it's valid (even if 0)
        if (!isNaN(calculated)) {
          setCurrentProgress(calculated);
          return;
        }
      }
      // Fallback to initialProgress if dates are not available or calculation fails
      if (initialProgress !== undefined && initialProgress !== null) {
        setCurrentProgress(initialProgress);
      }
    };

    // Update immediately
    updateProgress();

    // Update every minute to keep it dynamic
    const interval = setInterval(updateProgress, 60000); // 60000ms = 1 minute

    return () => clearInterval(interval);
  }, [trialStartDate, trialEndDate, initialProgress, daysRemaining]);

  const handleClick = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      router.push("/settings/billing");
    }
  };

  return (
    <div className="px-3 py-3">
      <div 
        className="rounded-lg bg-card border border-border overflow-hidden relative cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label="Go to billing page"
      >
        {/* Main content section */}
        <div className="p-3 bg-card">
          {/* Free trial and days left */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-bold text-card-foreground">Free trial</span>
            <span className="text-sm text-muted-foreground font-medium">
              {daysRemaining} days left
            </span>
          </div>
          
          {/* Progress bar with slider-like appearance */}
          <div className="relative mb-3">
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, currentProgress))}%` }}
              />
            </div>
            {/* Vertical indicator/thumb at the end of progress */}
            {currentProgress > 0 && (
              <div 
                className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-primary transition-all duration-300"
                style={{ left: `calc(${Math.max(0, Math.min(100, currentProgress))}% - 1px)` }}
              />
            )}
          </div>
          
          {/* Plan name */}
          {planName && (
            <div className="text-xs text-muted-foreground font-medium capitalize">
              {planName} Plan
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

