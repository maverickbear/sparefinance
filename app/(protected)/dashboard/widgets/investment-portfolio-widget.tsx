"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";

interface InvestmentPortfolioWidgetProps {
  savings: number; // Fallback value if no portfolio data
  demoMode?: boolean; // If true, skip API calls (for public landing page)
}

interface PortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalCost: number;
  holdingsCount: number;
}

interface HistoricalDataPoint {
  date: string;
  value: number;
}

export function InvestmentPortfolioWidget({
  savings,
  demoMode = false,
}: InvestmentPortfolioWidgetProps) {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Skip API calls in demo mode (for public landing page)
    if (demoMode) {
      setIsLoading(false);
      return;
    }

    async function loadPortfolioData() {
      try {
        setIsLoading(true);
        
        // Fetch portfolio summary and historical data in parallel
        const [summaryRes, historicalRes] = await Promise.all([
          fetch("/api/portfolio/summary").catch(() => null),
          fetch("/api/portfolio/historical?days=30").catch(() => null),
        ]);

        if (summaryRes?.ok) {
          const summary = await summaryRes.json();
          setPortfolioSummary(summary);
        }

        if (historicalRes?.ok) {
          const historical = await historicalRes.json();
          setHistoricalData(Array.isArray(historical) ? historical : []);
        }
      } catch (error) {
        console.error("Error loading portfolio data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPortfolioData();
  }, [demoMode]);

  // Use portfolio data if available, otherwise fallback to savings
  const portfolioValue = portfolioSummary?.totalValue ?? savings;
  const dayChange = portfolioSummary?.dayChange ?? 0;
  const dayChangePercent = portfolioSummary?.dayChangePercent ?? 0;
  const totalReturn = portfolioSummary?.totalReturn ?? 0;
  const totalReturnPercent = portfolioSummary?.totalReturnPercent ?? 0;

  // Generate chart points from historical data
  const chartPoints = historicalData.length > 0
    ? (() => {
        const values = historicalData.map(d => d.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue || 1; // Avoid division by zero
        
        return historicalData.map((point, i) => {
          const x = (i / (historicalData.length - 1)) * 100;
          const normalizedValue = ((point.value - minValue) / range) * 100;
          const y = 100 - normalizedValue; // Invert Y axis (SVG coordinates)
          return `${x},${y}`;
        }).join(" ");
      })()
    : (() => {
        // Fallback: simple upward trend if no data
        return Array.from({ length: 12 }, (_, i) => {
          const x = (i / 11) * 100;
          const y = 100 - (i * 7);
          return `${x},${y}`;
        }).join(" ");
      })();

  // Determine asset mix from holdings count (simplified)
  const hasHoldings = portfolioSummary?.holdingsCount ? portfolioSummary.holdingsCount > 0 : false;
  const assetMix = hasHoldings ? "ETFs · Stocks · 401(k) · IRA" : "No investments yet";

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Investment Portfolio</CardTitle>
          <CardDescription>High-level performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Loading portfolio data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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

          {portfolioSummary && (
            <>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Today</span>
                <span className={cn(
                  "text-sm font-semibold tabular-nums",
                  dayChange >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {dayChange >= 0 ? "+" : ""}{formatMoneyCompact(Math.abs(dayChange))} ({dayChangePercent >= 0 ? "+" : ""}{dayChangePercent.toFixed(1)}%)
                </span>
              </div>

              {totalReturn !== 0 && (
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total return</span>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    totalReturn >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {totalReturn >= 0 ? "+" : ""}{formatMoneyCompact(Math.abs(totalReturn))} ({totalReturnPercent >= 0 ? "+" : ""}{totalReturnPercent.toFixed(1)}%)
                  </span>
                </div>
              )}
            </>
          )}

          {historicalData.length > 0 && (
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
          )}

          <div className="text-xs text-muted-foreground pt-2">
            <span className="text-muted-foreground">Mix:</span> {assetMix}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

