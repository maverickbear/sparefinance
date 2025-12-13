"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface QuickStatsWidgetProps {
  netCashFlow: number; // month-to-date
  savingsRate: number; // percentage
  savingsRateTarget?: number; // target percentage (default 15%)
  emergencyFundMonths: number;
  recommendedEmergencyFundMonths?: number; // default 6 months
}

export function QuickStatsWidget({
  netCashFlow,
  savingsRate,
  savingsRateTarget = 15,
  emergencyFundMonths,
  recommendedEmergencyFundMonths = 6,
}: QuickStatsWidgetProps) {
  const router = useRouter();
  const isPositiveCashFlow = netCashFlow >= 0;

  return (
    <Card className="h-full">
      <CardContent className="p-5 md:p-6">
        <div className="space-y-6 md:space-y-8">
          {/* Net Cash Flow */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Net cash flow (month-to-date)</div>
            <div className={cn(
              "text-lg md:text-xl font-semibold tabular-nums mb-2",
              isPositiveCashFlow ? "text-sentiment-positive" : "text-sentiment-negative"
            )}>
              {isPositiveCashFlow ? "+" : ""}{formatMoney(netCashFlow)}
            </div>
            {isPositiveCashFlow && (
              <div className="inline-flex items-center gap-1.5 text-xs rounded-full px-2 py-0.5 bg-sentiment-positive/10 text-sentiment-positive border border-sentiment-positive/20">
                <span>▲</span>
                <span>On track to save this month</span>
              </div>
            )}
          </div>

          {/* Savings Rate */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Savings rate</div>
            <div className="text-lg md:text-xl font-semibold tabular-nums mb-2">
              {savingsRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              Target: {savingsRateTarget}% •{" "}
              <button
                onClick={() => router.push("/planning/goals")}
                className="text-content-link hover:underline cursor-pointer"
              >
                Adjust goal
              </button>
            </div>
          </div>

          {/* Emergency Fund Coverage */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Emergency fund coverage</div>
            <div className="text-lg md:text-xl font-semibold tabular-nums mb-2">
              {emergencyFundMonths.toFixed(1)} months
            </div>
            <div className="text-xs text-muted-foreground">
              Recommended: {recommendedEmergencyFundMonths} months
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

