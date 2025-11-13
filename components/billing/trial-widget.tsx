"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TrialWidgetProps {
  daysRemaining: number;
  progress: number;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  onUpgrade?: () => void;
  planName?: "free" | "basic" | "premium" | null;
}

function calculateTrialDaysRemaining(trialEndDate: string | null | undefined): number {
  if (!trialEndDate) return 0;
  const endDate = new Date(trialEndDate);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function calculateTrialProgress(trialStartDate: string | null | undefined, trialEndDate: string | null | undefined): number {
  if (!trialStartDate || !trialEndDate) return 0;
  const startDate = new Date(trialStartDate);
  const endDate = new Date(trialEndDate);
  const now = new Date();
  const totalDuration = endDate.getTime() - startDate.getTime();
  
  if (totalDuration <= 0) return 0;
  
  // Calculate remaining time
  const remainingTime = endDate.getTime() - now.getTime();
  
  // Calculate progress as percentage of remaining time
  // This way the slider starts at 100% and decreases as days pass
  const progress = (remainingTime / totalDuration) * 100;
  
  return Math.min(100, Math.max(0, progress));
}

export function TrialWidget({ 
  daysRemaining, 
  progress: initialProgress,
  trialStartDate,
  trialEndDate,
  onUpgrade,
  planName 
}: TrialWidgetProps) {
  const [currentProgress, setCurrentProgress] = useState(initialProgress);
  const router = useRouter();

  // Update progress dynamically
  useEffect(() => {
    // Recalculate progress immediately
    const updateProgress = () => {
      if (trialStartDate && trialEndDate) {
        const newProgress = calculateTrialProgress(trialStartDate, trialEndDate);
        setCurrentProgress(newProgress);
      }
    };

    // Update immediately
    updateProgress();

    // Update every minute to keep it dynamic
    const interval = setInterval(updateProgress, 60000); // 60000ms = 1 minute

    return () => clearInterval(interval);
  }, [trialStartDate, trialEndDate]);

  const handleClick = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      router.push("/settings?tab=billing");
    }
  };

  return (
    <div className="px-3 py-3">
      <div 
        className="rounded-lg bg-card border border-border overflow-hidden relative cursor-pointer hover:bg-accent/50 transition-colors"
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
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${currentProgress}%` }}
              />
            </div>
            {/* Vertical indicator/thumb at the end of progress */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-primary"
              style={{ left: `calc(${currentProgress}% - 1px)` }}
            />
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

// Export helper functions for use in other components
export { calculateTrialDaysRemaining, calculateTrialProgress };

