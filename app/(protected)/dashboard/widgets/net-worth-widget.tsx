"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";

interface NetWorthWidgetProps {
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
}

export function NetWorthWidget({
  netWorth,
  totalAssets,
  totalDebts,
}: NetWorthWidgetProps) {
  const netWorthRatio = totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Net Worth Snapshot</CardTitle>
        <CardDescription>Assets minus debts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className={cn(
              "text-2xl font-bold tabular-nums mb-1",
              netWorth >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {formatMoneyCompact(netWorth)}
            </div>
            <div className="text-sm text-muted-foreground">Total net worth</div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Assets</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatMoneyCompact(totalAssets)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Debts</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatMoneyCompact(totalDebts)}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={netWorthRatio} aria-valuemin={0} aria-valuemax={100} aria-label={`${netWorthRatio.toFixed(0)}% net worth ratio`}>
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.max(Math.min(netWorthRatio, 100), 0)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

