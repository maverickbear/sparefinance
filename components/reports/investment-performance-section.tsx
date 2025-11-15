"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { TrendingUp, TrendingDown, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortfolioSummary, HistoricalDataPoint } from "@/lib/api/portfolio";
import type { Holding } from "@/lib/api/investments";
import { FeatureGuard } from "@/components/common/feature-guard";
import { PortfolioPerformanceChart } from "@/components/portfolio/portfolio-performance-chart";

interface InvestmentPerformanceSectionProps {
  portfolioSummary: PortfolioSummary | null;
  portfolioHoldings: Holding[];
  portfolioHistorical: HistoricalDataPoint[];
}

export function InvestmentPerformanceSection({
  portfolioSummary,
  portfolioHoldings,
  portfolioHistorical,
}: InvestmentPerformanceSectionProps) {
  if (!portfolioSummary) {
    return null;
  }

  const topHoldings = portfolioHoldings
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, 5);

  return (
    <FeatureGuard feature="hasInvestments" featureName="Investments">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Investment Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Value */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
                <p className="text-2xl font-bold">{formatMoney(portfolioSummary.totalValue)}</p>
              </div>

              {/* Total Return */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Return</p>
                <p
                  className={cn(
                    "text-2xl font-bold flex items-center gap-2",
                    portfolioSummary.totalReturn >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {portfolioSummary.totalReturn >= 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  {formatMoney(portfolioSummary.totalReturn)}
                </p>
                <p
                  className={cn(
                    "text-sm",
                    portfolioSummary.totalReturnPercent >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {portfolioSummary.totalReturnPercent >= 0 ? "+" : ""}
                  {portfolioSummary.totalReturnPercent.toFixed(2)}%
                </p>
              </div>

              {/* Day Change */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Day Change</p>
                <p
                  className={cn(
                    "text-2xl font-bold flex items-center gap-2",
                    portfolioSummary.dayChange >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {portfolioSummary.dayChange >= 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  {formatMoney(portfolioSummary.dayChange)}
                </p>
                <p
                  className={cn(
                    "text-sm",
                    portfolioSummary.dayChangePercent >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {portfolioSummary.dayChangePercent >= 0 ? "+" : ""}
                  {portfolioSummary.dayChangePercent.toFixed(2)}%
                </p>
              </div>

              {/* Holdings Count */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Holdings</p>
                <p className="text-2xl font-bold">{portfolioSummary.holdingsCount}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(portfolioSummary.totalCost)} total cost
                </p>
              </div>
            </div>

            {/* Performance Chart */}
            {portfolioHistorical.length > 0 && (
              <div className="mt-6">
                <PortfolioPerformanceChart
                  data={portfolioHistorical}
                  currentValue={portfolioSummary.totalValue}
                />
              </div>
            )}

            {/* Top Holdings */}
            {topHoldings.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3">Top 5 Holdings</h3>
                <div className="space-y-2">
                  {topHoldings.map((holding) => (
                    <div
                      key={`${holding.securityId}-${holding.accountId}`}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{holding.symbol}</p>
                        <p className="text-sm text-muted-foreground">{holding.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(holding.marketValue)}</p>
                        <p
                          className={cn(
                            "text-sm",
                            holding.unrealizedPnL >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {holding.unrealizedPnL >= 0 ? "+" : ""}
                          {formatMoney(holding.unrealizedPnL)} (
                          {holding.unrealizedPnLPercent >= 0 ? "+" : ""}
                          {holding.unrealizedPnLPercent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FeatureGuard>
  );
}

