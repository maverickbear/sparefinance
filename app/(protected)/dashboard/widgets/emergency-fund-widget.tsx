"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";

interface EmergencyFundWidgetProps {
  emergencyFundMonths: number;
  totalBalance: number;
  monthlyExpenses: number;
}

export function EmergencyFundWidget({
  emergencyFundMonths,
  totalBalance,
  monthlyExpenses,
}: EmergencyFundWidgetProps) {
  const recommendedMonths = 6;
  const progressPercentage = Math.min((emergencyFundMonths / recommendedMonths) * 100, 100);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Emergency Fund</CardTitle>
        <CardDescription>Months of expenses covered</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-foreground tabular-nums mb-1">
              {emergencyFundMonths.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">months of coverage</div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Current coverage</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {emergencyFundMonths.toFixed(1)} months
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Recommended</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {recommendedMonths} months
              </span>
            </div>
          </div>

          <div className="pt-2">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${progressPercentage.toFixed(0)}% of emergency fund reached`}>
              <div
                className={cn(
                  "h-full transition-all",
                  progressPercentage >= 100 ? "bg-sentiment-positive" :
                  progressPercentage >= 50 ? "bg-sentiment-warning" : "bg-sentiment-negative"
                )}
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

