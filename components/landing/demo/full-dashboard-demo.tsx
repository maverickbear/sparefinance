"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  FolderTree,
  Wallet,
  Users,
  PiggyBank,
  CreditCard,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { CategoryExpensesChart } from "@/components/charts/category-expenses-chart";
import { BudgetExecutionChart } from "@/components/charts/budget-execution-chart";
import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { FinancialHealthWidget } from "@/components/dashboard/financial-health-widget";
import { UpcomingTransactions } from "@/components/dashboard/upcoming-transactions";

const navSections = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    title: "Money Management",
    items: [
      { href: "/transactions", label: "Transactions", icon: Receipt },
      { href: "/categories", label: "Categories", icon: FolderTree },
      { href: "/accounts", label: "Accounts", icon: Wallet },
      { href: "/members", label: "Households", icon: Users },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/planning/budgets", label: "Budgets", icon: Target },
      { href: "/planning/goals", label: "Goals", icon: PiggyBank },
      { href: "/debts", label: "Debts", icon: CreditCard },
      { href: "/investments", label: "Investments", icon: TrendingUp },
    ],
  },
];

// Mobile bottom nav items
const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/planning/budgets", label: "Budgets", icon: Target },
  { href: "/debts", label: "Debts", icon: CreditCard },
];

// Fake data
const fakeMonthlyData = [
  { month: "Jul", income: 4200, expenses: 3200 },
  { month: "Aug", income: 4500, expenses: 3400 },
  { month: "Sep", income: 4800, expenses: 3600 },
  { month: "Oct", income: 5000, expenses: 3800 },
  { month: "Nov", income: 5200, expenses: 3750 },
  { month: "Dec", income: 5500, expenses: 4000 },
];

const fakeCategoryExpenses = [
  { name: "Groceries", value: 850, categoryId: "1" },
  { name: "Transportation", value: 650, categoryId: "2" },
  { name: "Entertainment", value: 450, categoryId: "3" },
  { name: "Utilities", value: 380, categoryId: "4" },
  { name: "Dining Out", value: 320, categoryId: "5" },
  { name: "Shopping", value: 280, categoryId: "6" },
  { name: "Healthcare", value: 220, categoryId: "7" },
  { name: "Education", value: 180, categoryId: "8" },
];

const fakeBudgetExecution = [
  { category: "Groceries", percentage: 64 },
  { category: "Entertainment", percentage: 93 },
  { category: "Transportation", percentage: 105 },
  { category: "Utilities", percentage: 76 },
  { category: "Dining Out", percentage: 58 },
];

const fakeGoals = [
  {
    id: "1",
    name: "Emergency Fund",
    targetAmount: 10000,
    currentBalance: 6500,
    incomePercentage: 15,
    priority: "High" as const,
    isCompleted: false,
    progressPct: 65,
    monthsToGoal: 8,
  },
  {
    id: "2",
    name: "Vacation Fund",
    targetAmount: 5000,
    currentBalance: 3200,
    incomePercentage: 10,
    priority: "Medium" as const,
    isCompleted: false,
    progressPct: 64,
    monthsToGoal: 6,
  },
  {
    id: "3",
    name: "New Car",
    targetAmount: 25000,
    currentBalance: 8500,
    incomePercentage: 20,
    priority: "High" as const,
    isCompleted: false,
    progressPct: 34,
    monthsToGoal: 18,
  },
];

const fakeFinancialHealth = {
  score: 85,
  classification: "Good" as "Excellent" | "Good" | "Fair" | "Poor" | "Critical",
  message: "Your Spare Score is in good shape. Keep up the good work!",
  monthlyIncome: 5200,
  monthlyExpenses: 3750,
  netAmount: 1450,
  savingsRate: 27.9,
  spendingDiscipline: "Good" as const,
  debtExposure: "Low" as const,
  emergencyFundMonths: 4,
  alerts: [
    {
      id: "1",
      severity: "warning" as "critical" | "warning" | "info",
      title: "Transportation budget exceeded",
      description: "You've spent 105% of your transportation budget this month.",
      action: "Review your transportation expenses",
    },
  ],
  suggestions: [
    {
      id: "1",
      title: "Increase emergency fund contribution",
      description: "Consider increasing your emergency fund savings rate.",
      impact: "high" as "high" | "medium" | "low",
    },
  ],
};

const fakeUpcomingTransactions = [
  {
    id: "1",
    date: new Date(2024, 11, 5),
    type: "expense",
    amount: 1200,
    description: "Rent Payment",
    account: { id: "1", name: "Checking Account" },
    category: { id: "1", name: "Housing" },
    originalDate: new Date(2024, 11, 5),
  },
  {
    id: "2",
    date: new Date(2024, 11, 10),
    type: "expense",
    amount: 150,
    description: "Internet Bill",
    account: { id: "1", name: "Checking Account" },
    category: { id: "2", name: "Utilities" },
    originalDate: new Date(2024, 11, 10),
  },
  {
    id: "3",
    date: new Date(2024, 11, 15),
    type: "income",
    amount: 5200,
    description: "Salary",
    account: { id: "1", name: "Checking Account" },
    category: { id: "3", name: "Salary" },
    originalDate: new Date(2024, 11, 15),
  },
];

export function FullDashboardDemo() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Demo data
  const summaryCards = [
    {
      title: "Total Balance",
      value: 12450.0,
      change: "+12.5%",
      trend: "up" as const,
      icon: Wallet,
    },
    {
      title: "Monthly Income",
      value: 5200.0,
      change: "+8.2%",
      trend: "up" as const,
      icon: ArrowUpRight,
    },
    {
      title: "Monthly Expenses",
      value: 3750.0,
      change: "-5.1%",
      trend: "down" as const,
      icon: ArrowDownRight,
    },
    {
      title: "Savings/Investments",
      value: 1450.0,
      change: "+15.3%",
      trend: "up" as const,
      icon: PiggyBank,
    },
  ];

  return (
    <div className="w-full max-w-full mx-auto h-[500px] overflow-hidden">
      <div className="flex h-full bg-background rounded-t-lg rounded-bl-none rounded-br-none overflow-hidden border-t border-l border-r shadow-2xl">
      {/* Sidebar - Hidden on mobile */}
      <TooltipProvider>
        <aside
          className={cn(
            "border-r bg-card transition-all duration-300 flex-shrink-0 hidden md:block",
            isCollapsed ? "w-16" : "w-64"
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div
              className={cn(
                "flex h-16 items-center border-b px-4",
                isCollapsed ? "justify-center" : "justify-between"
              )}
            >
              {!isCollapsed && (
                <div className="text-xl font-bold">Spare Finance</div>
              )}
            </div>

            {/* Navigation */}
            <nav
              className={cn(
                "flex-1 space-y-6 px-3 py-4",
                isCollapsed ? "overflow-visible" : "overflow-y-auto"
              )}
            >
              {navSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  {!isCollapsed && (
                    <h3 className="px-3 pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.title}
                    </h3>
                  )}
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === "/dashboard";
                    const linkElement = (
                      <div
                        className={cn(
                          "flex items-center rounded-[12px] text-sm font-medium transition-all duration-200 ease-in-out",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground",
                          isCollapsed
                            ? "justify-center px-3 py-2"
                            : "space-x-3 px-3 py-2"
                        )}
                        style={{ pointerEvents: "none" }}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </div>
                    );

                    if (isCollapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>
                            <div className="relative">{linkElement}</div>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return <div key={item.href}>{linkElement}</div>;
                  })}
                </div>
              ))}
            </nav>

            {/* User Profile */}
            <div className="border-t p-3">
              <div
                className={cn(
                  "flex items-center",
                  isCollapsed ? "justify-center" : "space-x-3 px-3 py-2"
                )}
              >
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold border">
                  JD
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium truncate">John Doe</div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      john@example.com
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Toggle Button - Hidden on mobile */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute top-4 h-5 w-5 z-[50] bg-card border border-border shadow-sm flex items-center justify-center hidden md:flex",
                isCollapsed ? "left-16" : "left-64"
              )}
              style={{ transform: "translateX(-50%)", pointerEvents: "none" }}
              onClick={() => {}}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={isCollapsed ? "right" : "bottom"}>
            {isCollapsed ? "Expand menu" : "Collapse menu"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900 pb-16 md:pb-0">
        <div className="px-4 py-4 md:py-6">
          {/* Header */}
          <div className="space-y-4 md:space-y-6 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Overview of your finances
                </p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((card, index) => {
                const Icon = card.icon;
                const isPositive = card.trend === "up";
                return (
                  <Card key={index} className="shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span
                          className={cn(
                            "text-xs font-medium",
                            isPositive ? "text-green-600" : "text-red-600"
                          )}
                        >
                          {card.change}
                        </span>
                      </div>
                      <CardTitle className="text-sm font-medium text-muted-foreground mt-2">
                        {card.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold">{formatMoney(card.value)}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Cash Flow and Spare Score */}
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2" style={{ pointerEvents: "none" }}>
              <IncomeExpensesChart data={fakeMonthlyData} />
              <FinancialHealthWidget data={fakeFinancialHealth} />
            </div>

            {/* Upcoming Transactions and Budget Execution */}
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2" style={{ pointerEvents: "none" }}>
              <UpcomingTransactions transactions={fakeUpcomingTransactions} />
              <BudgetExecutionChart data={fakeBudgetExecution} />
            </div>

            {/* Charts */}
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2" style={{ pointerEvents: "none" }}>
              <GoalsOverview goals={fakeGoals} />
              <CategoryExpensesChart 
                data={fakeCategoryExpenses} 
                totalIncome={5200} 
              />
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation - Mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden" style={{ pointerEvents: "none" }}>
        <div className="flex h-16 items-center justify-around">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/dashboard";
            return (
              <div
                key={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className={cn("text-[10px]", isActive && "text-primary")}>{item.label}</span>
              </div>
            );
          })}
        </div>
      </nav>
      </div>
    </div>
  );
}
