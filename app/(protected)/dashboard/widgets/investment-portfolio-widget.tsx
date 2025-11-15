"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";

interface InvestmentPortfolioWidgetProps {
  savings: number;
}

export function InvestmentPortfolioWidget({
  savings,
}: InvestmentPortfolioWidgetProps) {
  // Mock data for day change (in real app, this would come from API)
  const portfolioValue = savings;
  const dayChange = portfolioValue * 0.004; // 0.4% change
  const dayChangePercent = 0.4;

  // Mock chart data (simple upward trend)
  const chartPoints = Array.from({ length: 12 }, (_, i) => {
    const x = (i / 11) * 100;
    const y = 100 - (i * 7); // Simple upward trend
    return `${x},${y}`;
  }).join(" ");

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Investment Portfolio</CardTitle>
        <CardDescription>High-level performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-foreground tabular-nums mb-1">
              {formatMoneyCompact(portfolioValue)}
            </div>
            <div className="text-sm text-muted-foreground">Portfolio value</div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Today</span>
            <span className={cn(
              "text-sm font-semibold tabular-nums",
              dayChange >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {dayChange >= 0 ? "+" : ""}{formatMoneyCompact(Math.abs(dayChange))} ({dayChangePercent >= 0 ? "+" : ""}{dayChangePercent.toFixed(1)}%)
            </span>
          </div>

          <div className="bg-muted rounded-lg p-3 border border-border">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-20"
              aria-label="Portfolio performance chart"
            >
              <polyline
                points={chartPoints}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="text-xs text-muted-foreground pt-2">
            <span className="text-muted-foreground">Mix:</span> ETFs · Stocks · 401(k) · IRA
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

