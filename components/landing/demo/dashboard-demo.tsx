"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";
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
  User, 
  ArrowUp, 
  ArrowDown 
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/common/logo";
import { FinancialSummaryWidget } from "@/app/(protected)/dashboard/widgets/financial-summary-widget";
import { FinancialHealthScoreWidget } from "@/app/(protected)/dashboard/widgets/financial-health-score-widget";
import { ExpensesByCategoryWidget } from "@/app/(protected)/dashboard/widgets/expenses-by-category-widget";
import { CashFlowTimelineWidget } from "@/app/(protected)/dashboard/widgets/cash-flow-timeline-widget";
import { CashOnHandWidget } from "@/app/(protected)/dashboard/widgets/cash-on-hand-widget";
import { BudgetStatusWidget } from "@/app/(protected)/dashboard/widgets/budget-status-widget";
import { UpcomingBillsWidget } from "@/app/(protected)/dashboard/widgets/upcoming-bills-widget";
import { SavingsGoalsWidget } from "@/app/(protected)/dashboard/widgets/savings-goals-widget";
import { NetWorthWidget } from "@/app/(protected)/dashboard/widgets/net-worth-widget";
import { InvestmentPortfolioWidget } from "@/app/(protected)/dashboard/widgets/investment-portfolio-widget";
import { AlertsInsightsWidget } from "@/app/(protected)/dashboard/widgets/alerts-insights-widget";

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
      { href: "/planning/budgets", label: "Budgets", icon: PiggyBank },
      { href: "/planning/goals", label: "Goals", icon: PiggyBank },
      { href: "/debts", label: "Debts", icon: CreditCard },
      { href: "/investments", label: "Investments", icon: TrendingUp },
    ],
  },
];

// Mock data for demo
const mockSelectedMonthTransactions = [
  { id: "1", type: "income", amount: 8000, category: { id: "1", name: "Salary" }, date: "2024-12-01" },
  { id: "2", type: "expense", amount: -1200, category: { id: "2", name: "Food & Dining" }, date: "2024-12-05", expenseType: "variable" },
  { id: "3", type: "expense", amount: -850, category: { id: "3", name: "Transportation" }, date: "2024-12-10", expenseType: "variable" },
  { id: "4", type: "expense", amount: -450, category: { id: "4", name: "Entertainment" }, date: "2024-12-15", expenseType: "variable" },
  { id: "5", type: "expense", amount: -380, category: { id: "5", name: "Utilities" }, date: "2024-12-20", expenseType: "fixed" },
  { id: "6", type: "expense", amount: -320, category: { id: "6", name: "Shopping" }, date: "2024-12-22", expenseType: "variable" },
  { id: "7", type: "expense", amount: -220, category: { id: "7", name: "Healthcare" }, date: "2024-12-25", expenseType: "variable" },
];

const mockLastMonthTransactions = [
  { id: "1", type: "income", amount: 7500, category: { id: "1", name: "Salary" }, date: "2024-11-01" },
  { id: "2", type: "expense", amount: -3700, category: { id: "2", name: "Food & Dining" }, date: "2024-11-05" },
];

const mockChartTransactions = [
  { id: "1", type: "income", amount: 5000, date: "2024-07-01" },
  { id: "2", type: "expense", amount: -3200, date: "2024-07-15" },
  { id: "3", type: "income", amount: 5500, date: "2024-08-01" },
  { id: "4", type: "expense", amount: -3500, date: "2024-08-15" },
  { id: "5", type: "income", amount: 6000, date: "2024-09-01" },
  { id: "6", type: "expense", amount: -3800, date: "2024-09-15" },
  { id: "7", type: "income", amount: 6500, date: "2024-10-01" },
  { id: "8", type: "expense", amount: -4000, date: "2024-10-15" },
  { id: "9", type: "income", amount: 7000, date: "2024-11-01" },
  { id: "10", type: "expense", amount: -4200, date: "2024-11-15" },
  { id: "11", type: "income", amount: 8000, date: "2024-12-01" },
  { id: "12", type: "expense", amount: -3500, date: "2024-12-15" },
];

const mockFinancialHealth = {
  score: 85,
  classification: "Excellent" as const,
  monthlyIncome: 8000,
  monthlyExpenses: 3500,
  netAmount: 4500,
  savingsRate: 56.25,
  message: "Your financial health is excellent! Keep up the great work.",
  spendingDiscipline: "Excellent" as const,
  debtExposure: "Low" as const,
  emergencyFundMonths: 8.5,
  lastMonthScore: 82,
  alerts: [],
  suggestions: [],
};

const mockBudgets = [
  {
    id: "1",
    category: { id: "2", name: "Food & Dining" },
    amount: 1600,
    actualSpend: 1200,
    percentage: 75,
    status: "ok",
    displayName: "Food & Dining",
  },
  {
    id: "2",
    category: { id: "3", name: "Transportation" },
    amount: 800,
    actualSpend: 672,
    percentage: 84,
    status: "warning",
    displayName: "Transportation",
  },
  {
    id: "3",
    category: { id: "6", name: "Shopping" },
    amount: 400,
    actualSpend: 475,
    percentage: 118.75,
    status: "over",
    displayName: "Shopping",
  },
  {
    id: "4",
    category: { id: "4", name: "Entertainment" },
    amount: 500,
    actualSpend: 450,
    percentage: 90,
    status: "ok",
    displayName: "Entertainment",
  },
];

const mockUpcomingTransactions = [
  {
    id: "1",
    date: new Date(2024, 11, 15),
    type: "expense",
    amount: -1200,
    description: "Rent Payment",
    account: { id: "1", name: "Checking Account" },
    category: { id: "1", name: "Housing" },
    originalDate: new Date(2024, 11, 15),
  },
  {
    id: "2",
    date: new Date(2024, 11, 20),
    type: "expense",
    amount: -350,
    description: "Electricity Bill",
    account: { id: "1", name: "Checking Account" },
    category: { id: "5", name: "Utilities" },
    originalDate: new Date(2024, 11, 20),
  },
  {
    id: "3",
    date: new Date(2024, 11, 25),
    type: "income",
    amount: 5000,
    description: "Salary",
    account: { id: "1", name: "Checking Account" },
    category: { id: "1", name: "Salary" },
    originalDate: new Date(2024, 11, 25),
  },
];

const mockGoals = [
  {
    id: "1",
    name: "Emergency Fund",
    type: "savings",
    targetAmount: 10000,
    currentAmount: 6500,
    savedAmount: 6500,
  },
  {
    id: "2",
    name: "Vacation",
    type: "savings",
    targetAmount: 5000,
    currentAmount: 2500,
    savedAmount: 2500,
  },
  {
    id: "3",
    name: "New Car",
    type: "savings",
    targetAmount: 20000,
    currentAmount: 8000,
    savedAmount: 8000,
  },
];

const mockAccounts = [
  { id: "1", name: "Checking Account", balance: 12500, type: "checking" },
  { id: "2", name: "Savings Account", balance: 18000, type: "savings" },
];

export function DashboardDemo() {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Calculate demo values
  const totalBalance = mockAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const checkingBalance = mockAccounts
    .filter((acc) => acc.type === "checking" || acc.type === "depository")
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const savingsBalance = mockAccounts
    .filter((acc) => acc.type === "savings")
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const savings = 25000; // Investment portfolio
  const currentIncome = 8000;
  const currentExpenses = 3500;
  const lastMonthIncome = 7500;
  const lastMonthExpenses = 3700;
  const totalAssets = totalBalance + savings;
  const totalDebts = 5000;
  const netWorth = totalAssets - totalDebts;
  const emergencyFundMonths = totalBalance > 0 ? totalBalance / currentExpenses : 0;

  return (
    <>
      {/* Desktop Version */}
      <div className="hidden md:flex h-[700px] bg-background overflow-hidden pointer-events-none min-w-0">
        {/* Side Menu */}
        <TooltipProvider>
          <aside
            className={cn(
              "border-r bg-card transition-all duration-300 flex-shrink-0",
              isCollapsed ? "w-16" : "md:w-56 lg:w-64"
            )}
          >
            <div className="flex h-full flex-col">
              <div
                className={cn(
                  "flex h-16 items-center border-b px-4 relative",
                  isCollapsed ? "justify-center" : "justify-between"
                )}
              >
                {isCollapsed ? (
                  <Logo variant="icon" color="auto" width={32} height={32} />
                ) : (
                  <Logo variant="wordmark" color="auto" height={32} />
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
                  isCollapsed ? "left-16" : "md:left-56 lg:left-64"
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-5 lg:p-6">
          <div className="h-full flex flex-col space-y-4 md:space-y-5 lg:space-y-6 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between flex-shrink-0">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Financial Overview</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  Track your financial health: cash flow, spending, bills, buffers, risk and long-term planning.
                </p>
              </div>
            </div>

            {/* Financial Summary - Full Width */}
            <div className="flex-shrink-0 min-w-0 w-full">
              <FinancialSummaryWidget
                totalBalance={totalBalance}
                monthlyIncome={currentIncome}
                monthlyExpense={currentExpenses}
                totalSavings={savings}
                lastMonthIncome={lastMonthIncome}
                lastMonthExpense={lastMonthExpenses}
              />
            </div>

            {/* Top Widgets - Financial Health Score and Expenses by Category side by side */}
            <div className="grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-2 flex-shrink-0 min-w-0">
              <div className="min-w-0">
                <FinancialHealthScoreWidget
                financialHealth={mockFinancialHealth}
                selectedMonthTransactions={mockSelectedMonthTransactions}
                lastMonthTransactions={mockLastMonthTransactions}
              />
              </div>
              <div className="min-w-0">
                <ExpensesByCategoryWidget
                  selectedMonthTransactions={mockSelectedMonthTransactions}
                  selectedMonthDate={new Date()}
                />
              </div>
            </div>

            {/* Cash Flow and Cash on Hand - Same Row */}
            <div className="grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-2 flex-shrink-0 min-w-0">
              <div className="min-w-0">
                <CashFlowTimelineWidget
                chartTransactions={mockChartTransactions}
                selectedMonthDate={new Date()}
              />
              </div>
              <div className="min-w-0">
                <CashOnHandWidget
                  totalBalance={totalBalance}
                  checkingBalance={checkingBalance}
                  savingsBalance={savingsBalance}
                />
              </div>
            </div>

            {/* Budget Status and Upcoming Transactions - Same Row */}
            <div className="grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-2 flex-shrink-0 min-w-0">
              <div className="min-w-0">
                <BudgetStatusWidget budgets={mockBudgets} />
              </div>
              <div className="min-w-0">
                <UpcomingBillsWidget upcomingTransactions={mockUpcomingTransactions} />
              </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 flex-1 min-h-0 min-w-0">
              <SavingsGoalsWidget goals={mockGoals} />
              <NetWorthWidget
                netWorth={netWorth}
                totalAssets={totalAssets}
                totalDebts={totalDebts}
              />
              <InvestmentPortfolioWidget savings={savings} demoMode={true} />
              <div className="col-span-full">
                <AlertsInsightsWidget
                  financialHealth={mockFinancialHealth}
                  currentIncome={currentIncome}
                  currentExpenses={currentExpenses}
                  emergencyFundMonths={emergencyFundMonths}
                  selectedMonthTransactions={mockSelectedMonthTransactions}
                  lastMonthTransactions={mockLastMonthTransactions}
                  demoMode={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Version */}
      <div className="md:hidden h-[600px] bg-background overflow-hidden pointer-events-none flex flex-col">
        {/* Mobile Header */}
        <div className="flex-shrink-0 border-b bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Financial Overview</h1>
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold border">
              <User className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Mobile Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          {/* Financial Summary */}
          <FinancialSummaryWidget
            totalBalance={totalBalance}
            monthlyIncome={currentIncome}
            monthlyExpense={currentExpenses}
            totalSavings={savings}
            lastMonthIncome={lastMonthIncome}
            lastMonthExpense={lastMonthExpenses}
          />

          {/* Financial Health Score */}
          <FinancialHealthScoreWidget
            financialHealth={mockFinancialHealth}
            selectedMonthTransactions={mockSelectedMonthTransactions}
            lastMonthTransactions={mockLastMonthTransactions}
          />

          {/* Expenses by Category */}
          <ExpensesByCategoryWidget
            selectedMonthTransactions={mockSelectedMonthTransactions}
            selectedMonthDate={new Date()}
          />

          {/* Cash Flow Timeline */}
          <CashFlowTimelineWidget
            chartTransactions={mockChartTransactions}
            selectedMonthDate={new Date()}
          />

          {/* Cash on Hand */}
          <CashOnHandWidget
            totalBalance={totalBalance}
            checkingBalance={checkingBalance}
            savingsBalance={savingsBalance}
          />

          {/* Budget Status */}
          <BudgetStatusWidget budgets={mockBudgets} />

          {/* Upcoming Bills */}
          <UpcomingBillsWidget upcomingTransactions={mockUpcomingTransactions} />

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
