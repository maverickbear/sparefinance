"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";

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

// Static demo chart points (upward trend)
const DEMO_CHART_POINTS = Array.from({ length: 12 }, (_, i) => {
  const x = (i / 11) * 100;
  const y = 100 - (i * 7);
  return `${x},${y}`;
}).join(" ");

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
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="w-full h-20"
                aria-label="Portfolio performance chart"
              >
                <polyline
                  points={DEMO_CHART_POINTS}
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
        
        // Fetch portfolio summary, historical data, holdings, and accounts in parallel
        const [summaryRes, historicalRes, holdingsRes, accountsRes] = await Promise.all([
          fetch("/api/portfolio/summary").catch(() => null),
          fetch("/api/portfolio/historical?days=30").catch(() => null),
          fetch("/api/portfolio/holdings").catch(() => null),
          fetch("/api/portfolio/accounts").catch(() => null),
        ]);

        if (summaryRes?.ok) {
          const summary = await summaryRes.json();
          setPortfolioSummary(summary);
        }

        if (historicalRes?.ok) {
          const historical = await historicalRes.json();
          setHistoricalData(Array.isArray(historical) ? historical : []);
        }

        // Calculate asset mix from holdings and accounts
        let assetTypes = new Set<string>();
        let accountTypes = new Set<string>();

        if (holdingsRes?.ok) {
          const holdings = await holdingsRes.json();
          if (Array.isArray(holdings)) {
            holdings.forEach((holding: any) => {
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
        }

        if (accountsRes?.ok) {
          const accounts = await accountsRes.json();
          if (Array.isArray(accounts)) {
            accounts.forEach((account: any) => {
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

        // Also fetch InvestmentAccount types directly if available
        try {
          const investmentAccountsRes = await fetch("/api/questrade/data").catch(() => null);
          if (investmentAccountsRes?.ok) {
            const data = await investmentAccountsRes.json();
            if (data.accounts && Array.isArray(data.accounts)) {
              data.accounts.forEach((account: any) => {
                if (account.type) {
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
        } catch (error) {
          // Silently fail - we already have account types from the accounts API
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
            <span className="text-muted-foreground">Mix:</span> {assetMix || "No investments yet"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

