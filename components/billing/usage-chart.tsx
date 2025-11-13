"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanFeatures } from "@/lib/validations/plan";
import { LimitCheckResult } from "@/lib/api/limits";

interface UsageChartProps {
  limits: PlanFeatures;
  transactionLimit: LimitCheckResult;
  accountLimit: LimitCheckResult;
}

export function UsageChart({ limits, transactionLimit, accountLimit }: UsageChartProps) {
  const getTotalUsage = () => {
    const transactionUsage = transactionLimit.limit === -1 ? 0 : transactionLimit.current;
    const accountUsage = accountLimit.limit === -1 ? 0 : accountLimit.current;
    return transactionUsage + accountUsage;
  };

  const getTotalLimit = () => {
    const transactionMax = transactionLimit.limit === -1 ? 0 : transactionLimit.limit;
    const accountMax = accountLimit.limit === -1 ? 0 : accountLimit.limit;
    return transactionMax + accountMax;
  };

  const totalUsage = getTotalUsage();
  const totalLimit = getTotalLimit();

  // Calculate percentages based on total usage (for segmented bar)
  const getTransactionPercentageOfUsage = () => {
    if (totalUsage === 0) return 0;
    const transactionUsage = transactionLimit.limit === -1 ? 0 : transactionLimit.current;
    return (transactionUsage / totalUsage) * 100;
  };

  const getAccountPercentageOfUsage = () => {
    if (totalUsage === 0) return 0;
    const accountUsage = accountLimit.limit === -1 ? 0 : accountLimit.current;
    return (accountUsage / totalUsage) * 100;
  };

  // Calculate overall usage percentage (for bar width)
  const overallUsagePercentage = totalLimit > 0 ? (totalUsage / totalLimit) * 100 : 0;

  const transactionPercentageOfUsage = getTransactionPercentageOfUsage();
  const accountPercentageOfUsage = getAccountPercentageOfUsage();

  const formatLimit = (limit: number) => {
    if (limit === -1) return "Unlimited";
    return limit.toLocaleString();
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl">Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pl-6 pr-6 pb-6 pt-0">
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">
              {totalUsage.toLocaleString()} / {formatLimit(totalLimit)} used this month
            </span>
          </div>
          
          {/* Segmented Bar Chart */}
          <div className="w-full h-4 bg-muted rounded-lg overflow-hidden relative">
            <div 
              className="h-full flex transition-all"
              style={{ width: `${Math.min(overallUsagePercentage, 100)}%` }}
            >
              {transactionLimit.limit !== -1 && transactionLimit.current > 0 && (
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${transactionPercentageOfUsage}%` }}
                />
              )}
              {accountLimit.limit !== -1 && accountLimit.current > 0 && (
                <div
                  className="bg-pink-500 h-full transition-all"
                  style={{ width: `${accountPercentageOfUsage}%` }}
                />
              )}
            </div>
          </div>

          {/* Legend */}
          {totalUsage > 0 && (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {transactionLimit.limit !== -1 && transactionLimit.current > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>
                    Transactions {Math.round(transactionPercentageOfUsage)}%
                  </span>
                </div>
              )}
              {accountLimit.limit !== -1 && accountLimit.current > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-pink-500" />
                  <span>
                    Accounts {Math.round(accountPercentageOfUsage)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detailed breakdown */}
        <div className="space-y-2 sm:space-y-3 pt-2 border-t">
          <div className="flex justify-between items-center">
            <span className="text-xs sm:text-sm">Transactions</span>
            <span className="text-xs sm:text-sm font-medium">
              {transactionLimit.current.toLocaleString()} / {formatLimit(transactionLimit.limit)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs sm:text-sm">Accounts</span>
            <span className="text-xs sm:text-sm font-medium">
              {accountLimit.current.toLocaleString()} / {formatLimit(accountLimit.limit)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

