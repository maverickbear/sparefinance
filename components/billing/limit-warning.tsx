"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface LimitWarningProps {
  current: number;
  limit: number;
  type: "transactions" | "accounts";
  className?: string;
}

export function LimitWarning({ current, limit, type, className = "" }: LimitWarningProps) {
  // Show warning when at 80% or more
  const percentage = (current / limit) * 100;
  const showWarning = percentage >= 80;

  if (!showWarning || limit === -1) {
    return null;
  }

  const isAtLimit = current >= limit;
  const remaining = limit - current;
  const typeName = type === "transactions" ? "transactions" : "accounts";
  const typeNameSingular = type === "transactions" ? "transaction" : "account";

  return (
    <Alert className={`border-sentiment-warning/50 bg-sentiment-warning/10 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
      <AlertTitle className="text-yellow-900 dark:text-yellow-100">
        {isAtLimit ? `You've reached your limit! 🎯` : `Approaching Limit`}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <div>
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {isAtLimit
              ? type === "accounts"
                ? `You're using all ${limit} of your ${typeName}.`
                : `You've used all ${limit} ${typeName} this month.`
              : `You've used ${current} of ${limit} ${typeName} this month. ${remaining} ${typeNameSingular}${remaining !== 1 ? "s" : ""} remaining.`}
          </p>
        </div>
        <div className="space-y-2">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-yellow-200 dark:bg-yellow-900/30">
            <div
              className={`h-full transition-all ${
                isAtLimit ? "bg-sentiment-negative" : "bg-sentiment-warning"
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-yellow-700 dark:text-yellow-300">
            <span>{current} / {limit}</span>
            <span>{percentage.toFixed(0)}%</span>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
