"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";

interface CashOnHandWidgetProps {
  totalBalance: number;
  checkingBalance: number;
  savingsBalance: number;
}

export function CashOnHandWidget({
  totalBalance,
  checkingBalance,
  savingsBalance,
}: CashOnHandWidgetProps) {
  const checkingPercentage = totalBalance > 0 ? (checkingBalance / totalBalance) * 100 : 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Cash on Hand</CardTitle>
        <CardDescription>Money you can use right now</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-foreground tabular-nums mb-1">
              {formatMoneyCompact(totalBalance)}
            </div>
            <div className="text-sm text-muted-foreground">Available balance</div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Checking</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatMoneyCompact(checkingBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Savings</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatMoneyCompact(savingsBalance)}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={checkingPercentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${checkingPercentage.toFixed(0)}% in checking account`}>
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(checkingPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

