"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { TrendingUp, TrendingDown, Wallet, BarChart3 } from "lucide-react";
import { PortfolioSummary } from "@/lib/mock-data/portfolio-mock-data";
import { cn } from "@/lib/utils";

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
}

export function PortfolioSummaryCards({ summary }: PortfolioSummaryCardsProps) {
  return (
    <div className="grid gap-6 md:gap-8 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            Total Portfolio Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-500" />
            <div className="text-lg md:text-xl font-semibold text-foreground">
              {formatMoney(summary.totalValue)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            Day Change
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {summary.dayChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-500" />
            )}
            <div
              className={cn(
                "text-lg md:text-xl font-semibold",
                summary.dayChange >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {summary.dayChange >= 0 ? "+" : ""}
              {formatMoney(summary.dayChange)}
            </div>
          </div>
          <div
            className={cn(
              "text-xs mt-1",
              summary.dayChangePercent >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {summary.dayChangePercent >= 0 ? "+" : ""}
            {summary.dayChangePercent.toFixed(2)}%
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            Total Return
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {summary.totalReturn >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-500" />
            )}
            <div
              className={cn(
                "text-lg md:text-xl font-semibold",
                summary.totalReturn >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {summary.totalReturn >= 0 ? "+" : ""}
              {formatMoney(summary.totalReturn)}
            </div>
          </div>
          <div
            className={cn(
              "text-xs mt-1",
              summary.totalReturnPercent >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {summary.totalReturnPercent >= 0 ? "+" : ""}
            {summary.totalReturnPercent.toFixed(2)}%
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            Holdings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-500" />
            <div className="text-lg md:text-xl font-semibold text-foreground">
              {summary.holdingsCount}
            </div>
          </div>
          <div className="text-xs mt-1 text-muted-foreground">
            Total positions
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

