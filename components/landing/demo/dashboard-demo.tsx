"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { ArrowUpRight, ArrowDownRight, Wallet, LayoutDashboard, Receipt, FileText, FolderTree, Users, PiggyBank, CreditCard, TrendingUp, ChevronLeft, ChevronRight, User, Calendar, Target } from "lucide-react";
import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { BudgetExecutionChart } from "@/components/charts/budget-execution-chart";
import { CategoryExpensesChart } from "@/components/charts/category-expenses-chart";
import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { FinancialHealthWidget } from "@/components/dashboard/financial-health-widget";
import { UpcomingTransactions } from "@/components/dashboard/upcoming-transactions";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Mock data
const mockTransactions = [
  { month: "Jul", income: 5000, expenses: 3200 },
  { month: "Aug", income: 5500, expenses: 3500 },
  { month: "Sep", income: 6000, expenses: 3800 },
  { month: "Oct", income: 6500, expenses: 4000 },
  { month: "Nov", income: 7000, expenses: 4200 },
  { month: "Dec", income: 8000, expenses: 3500 },
];

const mockBudgets = [
  { category: "Food & Dining", percentage: 75 },
  { category: "Transportation", percentage: 84 },
  { category: "Shopping", percentage: 118.75 },
  { category: "Entertainment", percentage: 90 },
];

const mockGoals = [
  {
    id: "1",
    name: "Emergency Fund",
    targetAmount: 10000,
    currentBalance: 6500,
    incomePercentage: 20,
    priority: "High" as const,
    isCompleted: false,
    progressPct: 65,
    monthsToGoal: 8,
    monthlyContribution: 500,
    incomeBasis: 5000,
  },
  {
    id: "2",
    name: "Vacation",
    targetAmount: 5000,
    currentBalance: 2500,
    incomePercentage: 10,
    priority: "Medium" as const,
    isCompleted: false,
    progressPct: 50,
    monthsToGoal: 5,
    monthlyContribution: 500,
    incomeBasis: 5000,
  },
];

const mockFinancialHealth = {
  score: 85,
  classification: "Excellent" as const,
  monthlyIncome: 8000,
  monthlyExpenses: 3500,
  netAmount: 4500,
  savingsRate: 56.25,
  message: "Your financial health is excellent! Keep up the great work.",
  alerts: [
    {
      id: "1",
      title: "High spending in Shopping category",
      description: "You've exceeded your budget by 18.75%",
      severity: "warning" as const,
      action: "Review your shopping expenses",
    },
  ],
  suggestions: [
    {
      id: "1",
      title: "Increase savings rate",
      description: "Consider saving 20% of your income",
      impact: "high" as const,
    },
  ],
};

const mockUpcomingTransactions = [
  {
    id: "1",
    date: new Date(2024, 11, 15),
    type: "expense",
    amount: 1200,
    description: "Rent Payment",
    account: { id: "1", name: "Checking Account" },
    category: { id: "1", name: "Housing" },
    originalDate: new Date(2024, 11, 15),
  },
  {
    id: "2",
    date: new Date(2024, 11, 20),
    type: "expense",
    amount: 350,
    description: "Electricity Bill",
    account: { id: "1", name: "Checking Account" },
    category: { id: "2", name: "Utilities" },
    originalDate: new Date(2024, 11, 20),
  },
  {
    id: "3",
    date: new Date(2024, 11, 25),
    type: "income",
    amount: 5000,
    description: "Salary",
    account: { id: "1", name: "Checking Account" },
    category: { id: "3", name: "Salary" },
    originalDate: new Date(2024, 11, 25),
  },
];

const mockCategoryExpenses = [
  { name: "Food & Dining", value: 850, categoryId: "1" },
  { name: "Transportation", value: 650, categoryId: "2" },
  { name: "Entertainment", value: 450, categoryId: "3" },
  { name: "Utilities", value: 380, categoryId: "4" },
  { name: "Shopping", value: 320, categoryId: "5" },
  { name: "Healthcare", value: 220, categoryId: "6" },
];

export function DashboardDemo() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Desktop Version */}
      <div className="hidden md:flex h-[700px] bg-gray-100 dark:bg-background overflow-hidden pointer-events-none">
        {/* Side Menu */}
        <TooltipProvider>
          <aside
            className={cn(
              "border-r bg-card transition-all duration-300 flex-shrink-0",
              isCollapsed ? "w-16" : "w-64"
            )}
          >
          <div className="flex h-full flex-col">
            <div
              className={cn(
                "flex h-16 items-center border-b px-4 relative",
                isCollapsed ? "justify-center" : "justify-between"
              )}
            >
              {!isCollapsed && (
                <div className="text-xl font-bold">Spare Finance</div>
              )}
            </div>

            <nav className={cn(
              "flex-1 space-y-6 px-3 py-4 overflow-hidden",
              isCollapsed && "overflow-visible"
            )}>
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
                          "flex items-center rounded-[12px] text-sm font-medium transition-all duration-200 ease-in-out cursor-pointer",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
                            <div className="relative">
                              {linkElement}
                              <TooltipContent side="right">
                                {item.label}
                              </TooltipContent>
                            </div>
                          </TooltipTrigger>
                        </Tooltip>
                      );
                    }

                    return <div key={item.href}>{linkElement}</div>;
                  })}
                </div>
              ))}
            </nav>

            <div className="border-t p-3">
              <div
                className={cn(
                  "flex items-center",
                  isCollapsed ? "justify-center" : "space-x-3 px-3 py-2"
                )}
              >
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold border">
                  <User className="h-6 w-6" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium truncate">
                      Demo User
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      demo@sparefinance.com
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
        {/* Toggle button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "absolute top-4 h-5 w-5 z-50 bg-card border border-border shadow-sm flex items-center justify-center",
                isCollapsed ? "left-16" : "left-64"
              )}
              style={{ transform: 'translateX(-50%)', pointerEvents: 'none' }}
              onClick={() => {}}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side={isCollapsed ? "right" : "bottom"}>
            {isCollapsed ? "Expand menu" : "Collapse menu"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between flex-shrink-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground">Overview of your finances</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 flex-shrink-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {formatMoney(45230)}
                </div>
              </div>
              <div className="text-xs mt-1 text-green-600 dark:text-green-400">
                +$2,450 (+5.7%)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">Monthly Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-500" />
                <div className="text-lg font-semibold text-foreground">{formatMoney(8000)}</div>
              </div>
              <div className="text-xs mt-1 text-green-600 dark:text-green-400">
                +12.5% vs last month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">Monthly Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-500" />
                <div className="text-lg font-semibold text-foreground">{formatMoney(3500)}</div>
              </div>
              <div className="text-xs mt-1 text-red-600 dark:text-red-400">
                -5.2% vs last month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">Savings/Investments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-foreground">{formatMoney(4500)}</div>
            </CardContent>
          </Card>
        </div>

          {/* Cash Flow and Financial Health */}
          <div className="grid gap-4 md:grid-cols-2 flex-shrink-0">
            <IncomeExpensesChart data={mockTransactions} />

            <FinancialHealthWidget 
              data={mockFinancialHealth}
              lastMonthIncome={7500}
              lastMonthExpenses={3700}
            />
          </div>

          {/* Upcoming Transactions and Budget Execution */}
          <div className="grid gap-4 md:grid-cols-2 flex-shrink-0">
          <UpcomingTransactions transactions={mockUpcomingTransactions} />
          <Card>
            <CardHeader>
              <CardTitle>Budget Execution</CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetExecutionChart data={mockBudgets} />
            </CardContent>
          </Card>
        </div>

          {/* Goals and Category Expenses */}
          <div className="grid gap-4 md:grid-cols-2 flex-1 min-h-0">
            <GoalsOverview goals={mockGoals} />
            <Card>
              <CardHeader>
                <CardTitle>Category Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryExpensesChart 
                  data={mockCategoryExpenses} 
                  totalIncome={8000} 
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>

      {/* Mobile Version */}
      <div className="md:hidden h-[600px] bg-gray-100 dark:bg-background overflow-hidden pointer-events-none flex flex-col">
        {/* Mobile Header */}
        <div className="flex-shrink-0 border-b bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Dashboard</h1>
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold border">
              <User className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Mobile Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          {/* Summary Cards */}
          <div className="grid gap-3 grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs text-muted-foreground font-normal">Total Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-blue-600 dark:text-blue-500" />
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {formatMoney(45230)}
                  </div>
                </div>
                <div className="text-[10px] mt-0.5 text-green-600 dark:text-green-400">
                  +$2,450 (+5.7%)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs text-muted-foreground font-normal">Monthly Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-500" />
                  <div className="text-sm font-semibold text-foreground">{formatMoney(8000)}</div>
                </div>
                <div className="text-[10px] mt-0.5 text-green-600 dark:text-green-400">
                  +12.5%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs text-muted-foreground font-normal">Monthly Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3 text-red-600 dark:text-red-500" />
                  <div className="text-sm font-semibold text-foreground">{formatMoney(3500)}</div>
                </div>
                <div className="text-[10px] mt-0.5 text-red-600 dark:text-red-400">
                  -5.2%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs text-muted-foreground font-normal">Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-semibold text-foreground">{formatMoney(4500)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <IncomeExpensesChart data={mockTransactions} />
            </CardContent>
          </Card>

          {/* Financial Health Widget */}
          <FinancialHealthWidget 
            data={mockFinancialHealth}
            lastMonthIncome={7500}
            lastMonthExpenses={3700}
          />

          {/* Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
            <div className="flex h-14 items-center justify-around">
              <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium text-primary">
                <LayoutDashboard className="h-5 w-5" />
                <span>Dashboard</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                <Receipt className="h-5 w-5" />
                <span>Transactions</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                <PiggyBank className="h-5 w-5" />
                <span>Budgets</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                <CreditCard className="h-5 w-5" />
                <span>Debts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
