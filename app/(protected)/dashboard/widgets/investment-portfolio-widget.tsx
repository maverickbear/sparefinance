"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

interface InvestmentPortfolioWidgetProps {
  savings: number; // Fallback value if no portfolio data
  demoMode?: boolean; // If true, render static demo content (no hooks, no API calls)
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

// Static demo data for landing page
const DEMO_PORTFOLIO_DATA = {
  totalValue: 125000,
  dayChange: 1250,
  dayChangePercent: 1.01,
  totalReturn: 25000,
  totalReturnPercent: 25.0,
  holdingsCount: 12,
};

// Static demo chart data (upward trend)
const DEMO_CHART_DATA = Array.from({ length: 12 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (11 - i));
  return {
    date: date.toISOString().split("T")[0],
    value: 100000 + (i * 2000),
  };
});

export function InvestmentPortfolioWidget({
  savings,
  demoMode = false,
}: InvestmentPortfolioWidgetProps) {
  // In demo mode, render completely static content (no hooks, no state, no logic)
  if (demoMode) {
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
                {formatMoneyCompact(DEMO_PORTFOLIO_DATA.totalValue)}
              </div>
              <div className="text-sm text-muted-foreground">Portfolio value</div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Today</span>
              <span className="text-sm font-semibold tabular-nums text-green-500">
                +{formatMoneyCompact(Math.abs(DEMO_PORTFOLIO_DATA.dayChange))} (+{DEMO_PORTFOLIO_DATA.dayChangePercent.toFixed(1)}%)
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Total return</span>
              <span className="text-sm font-semibold tabular-nums text-green-500">
                +{formatMoneyCompact(Math.abs(DEMO_PORTFOLIO_DATA.totalReturn))} (+{DEMO_PORTFOLIO_DATA.totalReturnPercent.toFixed(1)}%)
              </span>
            </div>

            <div className="bg-muted rounded-lg p-3 border border-border">
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={DEMO_CHART_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    tickFormatter={(value) => {
                      try {
                        return format(parseISO(value), "MMM dd");
                      } catch {
                        return value;
                      }
                    }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    width={50}
                    tickFormatter={(value) => {
                      if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                      return `$${value}`;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg bg-card border border-border p-3 shadow-lg">
                            <p className="mb-2 text-sm font-medium text-foreground">
                              {format(parseISO(data.date), "MMM dd, yyyy")}
                            </p>
                            <div className="text-sm font-semibold text-foreground">
                              {formatMoney(data.value)}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="text-xs text-muted-foreground pt-2">
              <span className="text-muted-foreground">Mix:</span> ETFs · Stocks · 401(k) · IRA
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Real component logic (only used in protected routes)
  const { limits, checking: limitsLoading } = useSubscription();
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [assetMix, setAssetMix] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has access to investments feature
  // The database is the source of truth - if a feature is disabled in Supabase, it should be disabled here
  const hasInvestmentsAccess = limits.hasInvestments === true;

  useEffect(() => {
    // Skip API calls if user doesn't have access to investments
    if (!hasInvestmentsAccess) {
      setIsLoading(false);
      return;
    }

    async function loadPortfolioData() {
      try {
        setIsLoading(true);
        
        // OPTIMIZED: Use /api/portfolio/all endpoint to fetch all data in one request
        // This avoids duplicate calls to getHoldings() and getInvestmentAccounts()
        const portfolioRes = await fetch("/api/portfolio/all?days=30").catch(() => null);

        if (portfolioRes?.ok) {
          const portfolioData = await portfolioRes.json();
          
          // Extract data from the combined response
          if (portfolioData.summary) {
            setPortfolioSummary(portfolioData.summary);
          }
          
          if (portfolioData.historical) {
            setHistoricalData(Array.isArray(portfolioData.historical) ? portfolioData.historical : []);
          }

          // Calculate asset mix from holdings and accounts
          let assetTypes = new Set<string>();
          let accountTypes = new Set<string>();

          if (portfolioData.holdings && Array.isArray(portfolioData.holdings)) {
            portfolioData.holdings.forEach((holding: any) => {
              if (holding.assetType) {
                // Map asset types to display names
                const assetTypeMap: Record<string, string> = {
                  "Stock": "Stocks",
                  "ETF": "ETFs",
                  "Crypto": "Crypto",
                  "Fund": "Funds",
                  "Bond": "Bonds",
                  "Option": "Options",
                };
                const displayName = assetTypeMap[holding.assetType] || holding.assetType;
                assetTypes.add(displayName);
              }
            });
          }

          if (portfolioData.accounts && Array.isArray(portfolioData.accounts)) {
            portfolioData.accounts.forEach((account: any) => {
              if (account.type) {
                // Map account types to display names
                const accountTypeMap: Record<string, string> = {
                  "401k": "401(k)",
                  "403b": "403(b)",
                  "ira": "IRA",
                  "roth_ira": "Roth IRA",
                  "sep_ira": "SEP IRA",
                  "brokerage": "Brokerage",
                  "taxable": "Taxable",
                  "retirement": "Retirement",
                };
                const displayName = accountTypeMap[account.type.toLowerCase()] || account.type;
                accountTypes.add(displayName);
              }
            });
          }
        }

        // Build mix string
        const mixParts: string[] = [];
        if (assetTypes.size > 0) {
          mixParts.push(Array.from(assetTypes).join(" · "));
        }
        if (accountTypes.size > 0) {
          mixParts.push(Array.from(accountTypes).join(" · "));
        }
        
        const mix = mixParts.length > 0 
          ? mixParts.join(" · ")
          : "No investments yet";
        
        setAssetMix(mix);
      } catch (error) {
        console.error("Error loading portfolio data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPortfolioData();
  }, [hasInvestmentsAccess]);

  // Use portfolio data if available, otherwise fallback to savings
  const portfolioValue = portfolioSummary?.totalValue ?? savings;
  const dayChange = portfolioSummary?.dayChange ?? 0;
  const dayChangePercent = portfolioSummary?.dayChangePercent ?? 0;
  const totalReturn = portfolioSummary?.totalReturn ?? 0;
  const totalReturnPercent = portfolioSummary?.totalReturnPercent ?? 0;

  // Prepare chart data from historical data
  const chartData = historicalData.length > 0
    ? historicalData
    : (() => {
        // Fallback: simple upward trend if no data
        const baseValue = portfolioValue * 0.8;
        return Array.from({ length: 12 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (11 - i));
          return {
            date: date.toISOString().split("T")[0],
            value: baseValue + (i * (portfolioValue - baseValue) / 11),
          };
        });
      })();


  // Show loading state while checking limits or loading data
  if (limitsLoading || isLoading) {
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

  // If user doesn't have access to investments, show savings only
  if (!hasInvestmentsAccess) {
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
                {formatMoneyCompact(savings)}
              </div>
              <div className="text-sm text-muted-foreground">Portfolio value</div>
            </div>
            <div className="text-xs text-muted-foreground pt-2">
              <span className="text-muted-foreground">Investments feature not available in your plan</span>
            </div>
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

          {chartData.length > 0 && (
            <div className="bg-muted rounded-lg p-3 border border-border">
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    tickFormatter={(value) => {
                      try {
                        return format(parseISO(value), "MMM dd");
                      } catch {
                        return value;
                      }
                    }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    width={50}
                    tickFormatter={(value) => {
                      if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                      return `$${value}`;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg bg-card border border-border p-3 shadow-lg">
                            <p className="mb-2 text-sm font-medium text-foreground">
                              {format(parseISO(data.date), "MMM dd, yyyy")}
                            </p>
                            <div className="text-sm font-semibold text-foreground">
                              {formatMoney(data.value)}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-2">
            <span className="text-muted-foreground">Mix:</span> {assetMix || "No investments yet"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

