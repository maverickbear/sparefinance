"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { useSubscriptionContext } from "@/contexts/subscription-context";
import { useCanAccessFeature } from "@/hooks/use-subscription-selectors";
import { usePortfolioData } from "@/hooks/use-portfolio-data";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { subMonths, format } from "date-fns";

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

import { sentiment, interactive } from "@/lib/design-system/colors";

interface HistoricalDataPoint {
  date: string;
  value: number;
}

// Colors for the chart - use design system colors
const PORTFOLIO_VALUE_COLOR = sentiment.positive; // #2F5711 - positive sentiment for portfolio value
const TOTAL_COST_COLOR = sentiment.negative; // #A8200D - negative sentiment for cost

// Custom tooltip component
interface TooltipEntry {
  payload: {
    month: string;
    [key: string]: unknown;
  };
  color: string;
  value: number;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-card border border-border p-3 shadow-lg">
        <p className="mb-2 text-sm font-medium text-foreground">
          {payload[0].payload.month}
        </p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">
                {entry.name}:
              </span>
              <span className="text-sm font-semibold text-foreground">
                {formatMoney(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Custom legend component
interface LegendEntry {
  color: string;
  value: string;
}

interface CustomLegendProps {
  payload?: LegendEntry[];
}

const CustomLegend = ({ payload }: CustomLegendProps) => {
  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      {payload?.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

// Static demo data for landing page
const DEMO_PORTFOLIO_DATA = {
  totalValue: 125000,
  totalCost: 100000,
};

export function InvestmentPortfolioWidget({
  savings,
  demoMode = false,
}: InvestmentPortfolioWidgetProps) {
  // In demo mode, render completely static content (no hooks, no state, no logic)
  if (demoMode) {
    const netReturn = DEMO_PORTFOLIO_DATA.totalValue - DEMO_PORTFOLIO_DATA.totalCost;
    const chartData = useMemo(() => {
      const months = [];
      const now = new Date();
      
      // Generate data for last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(now, i);
        const monthLabel = format(date, "MMM");
        
        // Create a trend: start lower and gradually increase to current values
        const progress = i === 5 ? 0.85 : i === 0 ? 1.0 : 0.85 + (5 - i) * 0.03;
        const valueProgress = i === 5 ? 0.85 : i === 0 ? 1.0 : 0.85 + (5 - i) * 0.03;
        const costProgress = i === 5 ? 0.90 : i === 0 ? 1.0 : 0.90 + (5 - i) * 0.02;
        
        months.push({
          month: monthLabel,
          portfolioValue: Math.max(0, DEMO_PORTFOLIO_DATA.totalValue * valueProgress),
          totalCost: Math.max(0, DEMO_PORTFOLIO_DATA.totalCost * costProgress),
        });
      }
      
      return months;
    }, []);

    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Investment Portfolio</CardTitle>
          <CardDescription>Portfolio Value vs Total Cost over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold tabular-nums mb-1 text-foreground">
                {formatMoneyCompact(netReturn)}
              </div>
              <div className="text-sm text-muted-foreground">Total return</div>
            </div>

            <div 
              className="h-[250px] min-h-[250px] w-full"
              style={{ minWidth: 0, position: 'relative' }}
            >
              <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                  <LineChart 
                    data={chartData} 
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.3}
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={{ stroke: "hsl(var(--border))" }}
                      width={60}
                      tickFormatter={(value) => {
                        if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                        return `$${value}`;
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <Line
                      type="monotone"
                      dataKey="portfolioValue"
                      name="Portfolio Value"
                      stroke={PORTFOLIO_VALUE_COLOR}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalCost"
                      name="Total Cost"
                      stroke={TOTAL_COST_COLOR}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Real component logic (only used in protected routes)
  const { checking: limitsLoading } = useSubscriptionContext();
  
  // Check if user has access to investments feature (using selector to prevent unnecessary re-renders)
  const hasInvestmentsAccess = useCanAccessFeature("hasInvestments");

  // OPTIMIZED: Use shared portfolio hook to avoid duplicate API calls
  const { data: portfolioData, isLoading } = usePortfolioData({
    days: 30,
    enabled: hasInvestmentsAccess,
  });

  const portfolioSummary = portfolioData.summary as PortfolioSummary | null;
  const historicalData = portfolioData.historical as HistoricalDataPoint[];

  // Use portfolio data if available, otherwise fallback to savings
  const portfolioValue = portfolioSummary?.totalValue ?? savings;
  const totalCost = portfolioSummary?.totalCost ?? 0;
  const netReturn = portfolioValue - totalCost;

  // Generate chart data for the last 6 months
  // Use historical data if available, otherwise create a trend based on current values
  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    // If we have historical data, use it
    if (historicalData.length > 0) {
      // Group historical data by month and get the last 6 months
      const monthlyData = new Map<string, number>();
      
      // Process historical data to get monthly values
      historicalData.forEach((point) => {
        try {
          const date = new Date(point.date);
          const monthKey = format(date, "MMM yyyy");
          const existing = monthlyData.get(monthKey);
          
          // Keep the highest value for each month
          if (!existing || point.value > existing) {
            monthlyData.set(monthKey, point.value);
          }
        } catch (e) {
          // Skip invalid dates
        }
      });
      
      // Get last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(now, i);
        const monthLabel = format(date, "MMM");
        const monthKey = format(date, "MMM yyyy");
        
        const monthlyValue = monthlyData.get(monthKey);
        if (monthlyValue !== undefined) {
          // Use historical value, estimate cost proportionally
          // Assume cost grows proportionally to value (simplified)
          const costRatio = portfolioValue > 0 && totalCost > 0 ? totalCost / portfolioValue : 0;
          months.push({
            month: monthLabel,
            portfolioValue: monthlyValue,
            totalCost: monthlyValue * costRatio,
          });
        } else {
          // If no data for this month, interpolate
          const progress = i === 5 ? 0.85 : i === 0 ? 1.0 : 0.85 + (5 - i) * 0.03;
          const costProgress = i === 5 ? 0.90 : i === 0 ? 1.0 : 0.90 + (5 - i) * 0.02;
          months.push({
            month: monthLabel,
            portfolioValue: Math.max(0, portfolioValue * progress),
            totalCost: Math.max(0, totalCost * costProgress),
          });
        }
      }
    } else {
      // No historical data - create a trend based on current values
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(now, i);
        const monthLabel = format(date, "MMM");
        
        // Create a trend: start lower and gradually increase to current values
        const progress = i === 5 ? 0.85 : i === 0 ? 1.0 : 0.85 + (5 - i) * 0.03;
        const costProgress = i === 5 ? 0.90 : i === 0 ? 1.0 : 0.90 + (5 - i) * 0.02;
        
        months.push({
          month: monthLabel,
          portfolioValue: Math.max(0, portfolioValue * progress),
          totalCost: Math.max(0, totalCost * costProgress),
        });
      }
    }
    
    return months;
  }, [portfolioValue, totalCost, historicalData]);

  // Show loading state while checking limits or loading data
  if (limitsLoading || isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Investment Portfolio</CardTitle>
          <CardDescription>Portfolio Value vs Total Cost over time</CardDescription>
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
          <CardDescription>Portfolio Value vs Total Cost over time</CardDescription>
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
        <CardDescription>Portfolio Value vs Total Cost over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold tabular-nums mb-1 text-foreground">
              {formatMoneyCompact(netReturn)}
            </div>
            <div className="text-sm text-muted-foreground">Total return</div>
          </div>

          <div 
            className="h-[250px] min-h-[250px] w-full"
            style={{ minWidth: 0, position: 'relative' }}
          >
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <LineChart 
                  data={chartData} 
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    width={60}
                    tickFormatter={(value) => {
                      if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                      return `$${value}`;
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend content={<CustomLegend />} />
                  <Line
                    type="monotone"
                    dataKey="portfolioValue"
                    name="Portfolio Value"
                    stroke={PORTFOLIO_VALUE_COLOR}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalCost"
                    name="Total Cost"
                    stroke={TOTAL_COST_COLOR}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
