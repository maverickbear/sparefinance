"use client";

// Dashboard widgets removed - using placeholders for feature promotions
import { Download, Users, Building2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { getCategoryColor } from "@/lib/utils/category-colors";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subDays, format } from "date-fns";

// Non-clickable Portfolio Performance Chart for promotions
function NonClickablePortfolioPerformanceWidget() {
  // Generate mock historical data for last 5 years (monthly data points)
  const mockData = [];
  const today = new Date();
  const startValue = 5000;
  const endValue = 47234.50;
  const months = 60; // 5 years * 12 months
  
  // Calculate annual growth rate needed to go from 5k to 47k in 5 years
  // Using compound interest formula: FV = PV * (1 + r)^n
  // 47234.50 = 5000 * (1 + r)^5
  // r = (47234.50/5000)^(1/5) - 1 ≈ 0.57 or 57% per year (very aggressive, but for demo)
  // For more realistic growth, let's use a smoother curve
  
  for (let i = months; i >= 0; i--) {
    const date = new Date(today);
    date.setMonth(date.getMonth() - i);
    
    // Generate a smoother growth curve (exponential growth)
    const progress = (months - i) / months;
    // Use exponential growth: start slow, accelerate, then slow down
    const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    const baseValue = startValue + (easedProgress * (endValue - startValue));
    
    // Add some realistic monthly variation (±5%)
    const variation = (Math.random() - 0.5) * 0.10;
    const value = Math.max(startValue * 0.8, baseValue * (1 + variation)); // Never go below 80% of start
    
    // Format date for display (show year for older dates, month for recent)
    let dateLabel: string;
    if (i > 12) {
      dateLabel = format(date, "MMM yyyy");
    } else {
      dateLabel = format(date, "MMM");
    }
    
    mockData.push({
      date: dateLabel,
      value: Math.round(value * 100) / 100,
      dateISO: date.toISOString().split('T')[0],
      monthIndex: i,
    });
  }

  const currentValue = mockData[mockData.length - 1]?.value || endValue;
  // Compare with value from 1 month ago
  const oneMonthAgoValue = mockData.find(d => d.monthIndex === 1)?.value || mockData[mockData.length - 2]?.value || startValue;
  const change = currentValue - oneMonthAgoValue;
  const changePercent = oneMonthAgoValue !== 0 ? ((change / oneMonthAgoValue) * 100) : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-sm">
          <div className="font-semibold text-sm">
            {data.dateISO ? format(new Date(data.dateISO), "MMM d, yyyy") : data.date}
          </div>
          <div className="text-sm text-muted-foreground">
            Value: {formatMoney(data.value)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full pointer-events-none">
      <CardHeader>
        <CardTitle>Portfolio Performance</CardTitle>
        <CardDescription>Last 5 years</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold tabular-nums mb-1">
              {formatMoney(currentValue)}
            </div>
            <div className={`text-sm font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{formatMoney(change)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%) today
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={mockData} 
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
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
                  interval="preserveStartEnd"
                  angle={-45}
                  textAnchor="end"
                  height={60}
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
        </div>
      </CardContent>
    </Card>
  );
}

interface FeaturePromotionWidgetProps {
  featureName: string;
}

// Mock data generators
function getMockBudgets(): Array<{
  id: string;
  period: string;
  amount: number;
  userId: string;
  isRecurring: boolean;
  displayName: string;
  actualSpend: number;
  percentage: number;
  status: "ok" | "warning" | "over";
  category: { id: string; name: string };
  categoryId?: string | null;
  subcategoryId?: string | null;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}> {
  const currentDate = new Date();
  const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
  
  return [
    {
      id: "1",
      period,
      amount: 500,
      userId: "mock-user-id",
      isRecurring: true,
      displayName: "Groceries",
      actualSpend: 450,
      percentage: 90,
      status: "warning" as const,
      category: { id: "cat-1", name: "Groceries" },
      categoryId: "cat-1",
      subcategoryId: null,
      note: null,
    },
    {
      id: "2",
      period,
      amount: 200,
      userId: "mock-user-id",
      isRecurring: true,
      displayName: "Dining Out",
      actualSpend: 180,
      percentage: 90,
      status: "warning" as const,
      category: { id: "cat-2", name: "Dining Out" },
      categoryId: "cat-2",
      subcategoryId: null,
      note: null,
    },
    {
      id: "3",
      period,
      amount: 150,
      userId: "mock-user-id",
      isRecurring: true,
      displayName: "Entertainment",
      actualSpend: 95,
      percentage: 63.3,
      status: "ok" as const,
      category: { id: "cat-3", name: "Entertainment" },
      categoryId: "cat-3",
      subcategoryId: null,
      note: null,
    },
  ];
}

function getMockGoals() {
  return [
    {
      id: "1",
      name: "Emergency Fund",
      targetAmount: 10000,
      currentAmount: 8500,
      type: "savings",
    },
    {
      id: "2",
      name: "Vacation",
      targetAmount: 5000,
      currentAmount: 2300,
      type: "savings",
    },
    {
      id: "3",
      name: "New Car",
      targetAmount: 25000,
      currentAmount: 12000,
      type: "savings",
    },
  ];
}

// Non-clickable Expenses by Category Widget for promotions
function NonClickableExpensesByCategoryWidget() {
  const expensesData = [
    { name: "Dining Out", value: 1234.50, percentage: 35.2, color: getCategoryColor("Dining Out") },
    { name: "Groceries", value: 856.20, percentage: 24.4, color: getCategoryColor("Groceries") },
    { name: "Entertainment", value: 432.00, percentage: 12.3, color: getCategoryColor("Entertainment") },
    { name: "Transportation", value: 320.50, percentage: 9.1, color: getCategoryColor("Transportation") },
    { name: "Shopping", value: 245.75, percentage: 7.0, color: getCategoryColor("Shopping") },
  ];

  const totalExpenses = expensesData.reduce((sum, item) => sum + item.value, 0);

  // Calculate donut chart segments
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 12;
  const svgSize = 180;
  const center = svgSize / 2;
  let accumulatedLength = 0;

  const segments = expensesData.map((item) => {
    const segmentLength = (item.percentage / 100) * circumference;
    const offset = -accumulatedLength;
    accumulatedLength += segmentLength;
    return {
      ...item,
      offset,
      segmentLength,
    };
  });

  return (
    <Card className="h-full pointer-events-none">
      <CardHeader>
        <div className="flex-1 space-y-1.5">
          <CardTitle>Expenses by Category</CardTitle>
          <CardDescription>Distribution of total expenses</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 lg:gap-6">
          {/* Donut Chart */}
          <div className="relative flex-shrink-0 w-[140px] h-[140px] lg:w-[180px] lg:h-[180px]">
            <svg
              className="transform -rotate-90 w-full h-full"
              viewBox={`0 0 ${svgSize} ${svgSize}`}
            >
              {/* Background circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeWidth}
              />
              {/* Segments */}
              {segments.map((segment, index) => (
                <circle
                  key={index}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${segment.segmentLength} ${circumference - segment.segmentLength}`}
                  strokeDashoffset={segment.offset}
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xl lg:text-2xl font-bold text-foreground tabular-nums">
                {formatMoneyCompact(totalExpenses)}
              </div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0 w-full">
            <div className="space-y-1">
              {expensesData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-md"
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div
                      className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs lg:text-sm font-medium text-foreground truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs lg:text-sm font-semibold text-foreground tabular-nums">
                      {formatMoneyCompact(item.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeaturePromotionWidget({ featureName }: FeaturePromotionWidgetProps) {
  // Budgets Widget - Placeholder
  if (featureName === "Budgets") {
    return (
      <Card className="h-full pointer-events-none">
        <CardHeader>
          <CardTitle>Budget Overview</CardTitle>
          <CardDescription>Track your spending</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">Budget Overview widget (placeholder)</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Goals Widget - Show mock goals widget
  if (featureName === "Goals") {
    const mockGoals = getMockGoals();
    return (
      <Card className="h-full pointer-events-none">
        <CardHeader>
          <CardTitle>Savings Goals</CardTitle>
          <CardDescription>Track your progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockGoals.map((goal) => {
              const progress = (goal.currentAmount / goal.targetAmount) * 100;
              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{goal.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Advanced Reports Widget - Non-clickable version
  if (featureName === "Advanced Reports") {
    return <NonClickableExpensesByCategoryWidget />;
  }

  // Investments Widget - Use non-clickable version
  if (featureName === "Investments") {
    return <NonClickablePortfolioPerformanceWidget />;
  }

  // Net Worth Widget (for Unlimited Accounts) - Placeholder
  if (featureName === "Unlimited Accounts") {
    return (
      <Card className="h-full pointer-events-none">
        <CardHeader>
          <CardTitle>Net Worth</CardTitle>
          <CardDescription>Track your wealth</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">Net Worth widget (placeholder)</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // CSV Import - Show import status
  if (featureName === "CSV Import") {
    return (
      <div className="bg-white dark:bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Import Complete</p>
            <p className="text-xs text-muted-foreground">2,847 transactions imported</p>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Categorized</span>
            <span className="font-medium text-green-600">2,623 (92%)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Needs review</span>
            <span className="font-medium text-yellow-600">224 (8%)</span>
          </div>
        </div>
      </div>
    );
  }

  // CSV Export - Show export preview
  if (featureName === "CSV Export") {
    return (
      <div className="bg-white dark:bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Export Ready</p>
            <p className="text-xs text-muted-foreground">All data included</p>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Transactions</span>
            <span className="font-medium">12,847 rows</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Accounts</span>
            <span className="font-medium">8 accounts</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date range</span>
            <span className="font-medium">Jan 2023 - Dec 2024</span>
          </div>
        </div>
      </div>
    );
  }

  // Debts - Show debt summary
  if (featureName === "Debts") {
    return (
      <div className="bg-white dark:bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Total Debt</p>
          <p className="text-2xl font-bold mb-4">$24,850</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Credit Card</span>
              <div className="text-right">
                <span className="font-medium">$4,250</span>
                <span className="text-muted-foreground ml-2">@ 19.99%</span>
              </div>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Car Loan</span>
              <div className="text-right">
                <span className="font-medium">$18,600</span>
                <span className="text-muted-foreground ml-2">@ 5.5%</span>
              </div>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Student Loan</span>
              <div className="text-right">
                <span className="font-medium">$2,000</span>
                <span className="text-muted-foreground ml-2">@ 4.5%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Debt-free date</span>
            <span className="font-semibold">Mar 2027</span>
          </div>
        </div>
      </div>
    );
  }

  // Household Members - Show household summary
  if (featureName === "Household Members") {
    return (
      <div className="bg-white dark:bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Household Overview</p>
              <p className="text-xs text-muted-foreground">3 members</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">You</span>
              <span className="font-medium">$12,450</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Partner</span>
              <span className="font-medium">$8,920</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Joint</span>
              <span className="font-medium">$5,640</span>
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total Household</span>
            <span className="font-semibold">$27,010</span>
          </div>
        </div>
      </div>
    );
  }

  // Bank Integration - Show connected banks
  if (featureName === "Bank Integration") {
    return (
      <div className="bg-white dark:bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Connected Banks</p>
              <p className="text-xs text-muted-foreground">Auto-syncing</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sentiment-positive"></div>
                <span>TD Canada Trust</span>
              </div>
              <span className="text-muted-foreground">2 accounts</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sentiment-positive"></div>
                <span>RBC Royal Bank</span>
              </div>
              <span className="text-muted-foreground">1 account</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sentiment-positive"></div>
                <span>CIBC</span>
              </div>
              <span className="text-muted-foreground">1 account</span>
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span>Last sync: 2 minutes ago</span>
          </div>
        </div>
      </div>
    );
  }

  // Unlimited Transactions - Show transaction summary
  if (featureName === "Unlimited Transactions") {
    return (
      <div className="bg-white dark:bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">This Month</p>
          <p className="text-2xl font-bold mb-4">247 transactions</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-medium text-green-600">$5,450</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-medium text-red-600">$4,230</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-semibold">Net</span>
              <span className="font-semibold text-green-600">+$1,220</span>
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span>No limits - track everything</span>
          </div>
        </div>
      </div>
    );
  }

  // Default: Show a simple preview card
  return (
    <div className="bg-white dark:bg-card rounded-lg border border-border shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <div className="h-5 w-5 rounded bg-primary/20"></div>
        </div>
        <div>
          <p className="text-sm font-semibold">{featureName} Preview</p>
          <p className="text-xs text-muted-foreground">See your data here</p>
        </div>
      </div>
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="h-2 bg-muted rounded w-3/4"></div>
        <div className="h-2 bg-muted rounded w-1/2"></div>
        <div className="h-2 bg-muted rounded w-2/3"></div>
      </div>
    </div>
  );
}

