"use client";

import { useState, useEffect } from "react";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { SummaryCards } from "@/app/(protected)/dashboard/summary-cards";
import { FinancialHealthScoreWidget } from "@/app/(protected)/dashboard/widgets/financial-health-score-widget";
// Removed: ExpensesByCategoryWidget and CashFlowTimelineWidget - replaced by new dashboard widgets
import { BudgetOverviewWidget } from "@/app/(protected)/dashboard/widgets/budget-overview-widget";
import { SubscriptionsRecurringGoalsWidget } from "@/app/(protected)/dashboard/widgets/subscriptions-recurring-goals-widget";
import { NetWorthWidget } from "@/app/(protected)/dashboard/widgets/net-worth-widget";
import { InvestmentPortfolioWidget } from "@/app/(protected)/dashboard/widgets/investment-portfolio-widget";
import { getDefaultFeatures } from "@/lib/utils/plan-features";
import type { TransactionWithRelations } from "@/src/domain/transactions/transactions.types";

// Mock data

const mockSelectedMonthTransactions: TransactionWithRelations[] = [
  { id: "1", type: "income", amount: 8000, accountId: "demo-account-1", category: { id: "1", name: "Salary" }, date: new Date(2024, 11, 1) },
  { id: "2", type: "expense", amount: -1200, accountId: "demo-account-1", category: { id: "2", name: "Food & Dining" }, date: new Date(2024, 11, 5), expenseType: "variable" },
  { id: "3", type: "expense", amount: -850, accountId: "demo-account-1", category: { id: "3", name: "Transportation" }, date: new Date(2024, 11, 10), expenseType: "variable" },
  { id: "4", type: "expense", amount: -450, accountId: "demo-account-1", category: { id: "4", name: "Entertainment" }, date: new Date(2024, 11, 15), expenseType: "variable" },
  { id: "5", type: "expense", amount: -380, accountId: "demo-account-1", category: { id: "5", name: "Utilities" }, date: new Date(2024, 11, 20), expenseType: "fixed" },
  { id: "6", type: "expense", amount: -320, accountId: "demo-account-1", category: { id: "6", name: "Shopping" }, date: new Date(2024, 11, 22), expenseType: "variable" },
  { id: "7", type: "expense", amount: -220, accountId: "demo-account-1", category: { id: "7", name: "Healthcare" }, date: new Date(2024, 11, 25), expenseType: "variable" },
  { id: "8", type: "expense", amount: -1500, accountId: "demo-account-1", category: { id: "8", name: "Housing" }, date: new Date(2024, 11, 1), expenseType: "fixed" },
  { id: "9", type: "expense", amount: -650, accountId: "demo-account-1", category: { id: "2", name: "Food & Dining" }, date: new Date(2024, 11, 12), expenseType: "variable" },
  { id: "10", type: "expense", amount: -420, accountId: "demo-account-1", category: { id: "2", name: "Food & Dining" }, date: new Date(2024, 11, 18), expenseType: "variable" },
];

const mockLastMonthTransactions: TransactionWithRelations[] = [
  { id: "1", type: "income", amount: 7500, accountId: "demo-account-1", category: { id: "1", name: "Salary" }, date: new Date(2024, 10, 1) },
  { id: "2", type: "expense", amount: -3700, accountId: "demo-account-1", category: { id: "2", name: "Food & Dining" }, date: new Date(2024, 10, 5) },
];

const mockFinancialHealth = {
  score: 85,
  classification: "Excellent" as const,
  monthlyIncome: 8000,
  monthlyExpenses: 3500,
  netAmount: 4500,
  savingsRate: 56.25,
  message: "Your Spare Score is excellent! Keep up the great work.",
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
    period: "2024-12-01 00:00:00",
    userId: "demo-user",
    isRecurring: true,
    category: { id: "2", name: "Food & Dining" },
    categoryId: "2",
    subcategoryId: null,
    note: null,
    amount: 1600,
    actualSpend: 1200,
    percentage: 75,
    status: "ok" as const,
    displayName: "Food & Dining",
  },
  {
    id: "2",
    period: "2024-12-01 00:00:00",
    userId: "demo-user",
    isRecurring: true,
    category: { id: "3", name: "Transportation" },
    categoryId: "3",
    subcategoryId: null,
    note: null,
    amount: 800,
    actualSpend: 672,
    percentage: 84,
    status: "warning" as const,
    displayName: "Transportation",
  },
  {
    id: "3",
    period: "2024-12-01 00:00:00",
    userId: "demo-user",
    isRecurring: true,
    category: { id: "6", name: "Shopping" },
    categoryId: "6",
    subcategoryId: null,
    note: null,
    amount: 400,
    actualSpend: 475,
    percentage: 118.75,
    status: "over" as const,
    displayName: "Shopping",
  },
  {
    id: "4",
    period: "2024-12-01 00:00:00",
    userId: "demo-user",
    isRecurring: true,
    category: { id: "4", name: "Entertainment" },
    categoryId: "4",
    subcategoryId: null,
    note: null,
    amount: 500,
    actualSpend: 450,
    percentage: 90,
    status: "ok" as const,
    displayName: "Entertainment",
  },
];

const mockGoals = [
  {
    id: "1",
    name: "Emergency Fund",
    targetAmount: 10000,
    currentBalance: 6500,
    incomePercentage: 20,
    priority: "High" as const,
    isPaused: false,
    isCompleted: false,
    userId: "demo-user",
    householdId: null,
    monthlyContribution: 500,
    monthsToGoal: 7,
    progressPct: 65,
    incomeBasis: 5000,
    createdAt: new Date(2024, 0, 1).toISOString(),
    updatedAt: new Date(2024, 11, 1).toISOString(),
  },
  {
    id: "2",
    name: "Vacation",
    targetAmount: 5000,
    currentBalance: 2500,
    incomePercentage: 10,
    priority: "Medium" as const,
    isPaused: false,
    isCompleted: false,
    userId: "demo-user",
    householdId: null,
    monthlyContribution: 300,
    monthsToGoal: 9,
    progressPct: 50,
    incomeBasis: 5000,
    createdAt: new Date(2024, 0, 1).toISOString(),
    updatedAt: new Date(2024, 11, 1).toISOString(),
  },
  {
    id: "3",
    name: "New Car",
    targetAmount: 20000,
    currentBalance: 8000,
    incomePercentage: 15,
    priority: "Medium" as const,
    isPaused: false,
    isCompleted: false,
    userId: "demo-user",
    householdId: null,
    monthlyContribution: 1000,
    monthsToGoal: 12,
    progressPct: 40,
    incomeBasis: 5000,
    createdAt: new Date(2024, 0, 1).toISOString(),
    updatedAt: new Date(2024, 11, 1).toISOString(),
  },
];

const mockRecurringPayments = [
  {
    id: "1",
    date: new Date(2024, 11, 15),
    type: "expense" as const,
    amount: -1200,
    accountId: "1",
    description: "Rent Payment",
    account: { id: "1", name: "Checking Account", type: "checking" },
    category: { id: "1", name: "Housing" },
    categoryId: "1",
    subcategoryId: null,
  },
  {
    id: "2",
    date: new Date(2024, 11, 20),
    type: "expense" as const,
    amount: -350,
    accountId: "1",
    description: "Electricity Bill",
    account: { id: "1", name: "Checking Account", type: "checking" },
    category: { id: "5", name: "Utilities" },
    categoryId: "5",
    subcategoryId: null,
  },
  {
    id: "3",
    date: new Date(2024, 11, 1),
    type: "expense" as const,
    amount: -99,
    accountId: "1",
    description: "Netflix",
    account: { id: "1", name: "Checking Account", type: "checking" },
    category: { id: "4", name: "Entertainment" },
    categoryId: "4",
    subcategory: { id: "1", name: "Streaming", logo: null },
    subcategoryId: "1",
  },
];

const mockSubscriptions = [
  {
    id: "1",
    userId: "demo-user",
    serviceName: "Netflix",
    amount: 99,
    billingFrequency: "monthly" as const,
    billingDay: 1,
    accountId: "demo-account-1",
    isActive: true,
    firstBillingDate: new Date(2024, 0, 1).toISOString(),
    createdAt: new Date(2024, 0, 1).toISOString(),
    updatedAt: new Date(2024, 0, 1).toISOString(),
    subcategory: { id: "1", name: "Streaming", logo: null },
    account: { id: "demo-account-1", name: "Checking Account" },
  },
  {
    id: "2",
    userId: "demo-user",
    serviceName: "Spotify",
    amount: 49,
    billingFrequency: "monthly" as const,
    billingDay: 5,
    accountId: "demo-account-1",
    isActive: true,
    firstBillingDate: new Date(2024, 0, 5).toISOString(),
    createdAt: new Date(2024, 0, 5).toISOString(),
    updatedAt: new Date(2024, 0, 5).toISOString(),
    subcategory: { id: "2", name: "Music", logo: null },
    account: { id: "demo-account-1", name: "Checking Account" },
  },
  {
    id: "3",
    userId: "demo-user",
    serviceName: "Gym Membership",
    amount: 79,
    billingFrequency: "monthly" as const,
    billingDay: 10,
    accountId: "demo-account-1",
    isActive: true,
    firstBillingDate: new Date(2024, 0, 10).toISOString(),
    createdAt: new Date(2024, 0, 10).toISOString(),
    updatedAt: new Date(2024, 0, 10).toISOString(),
    subcategory: { id: "3", name: "Fitness", logo: null },
    account: { id: "demo-account-1", name: "Checking Account" },
  },
];

export function DashboardDemoStatic() {
  // Get current date for demo - use state to avoid SSR issues
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date | null>(null);

  useEffect(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  // Calculate values using the same logic as the real dashboard
  const totalBalance = 30500;
  const savings = 25000;
  const lastMonthTotalBalance = 28000;

  // Mock accounts for SummaryCards
  const mockAccounts = [
    {
      id: "demo-account-1",
      name: "Checking Account",
      balance: 5500,
      type: "checking",
      userId: "demo-user",
    },
    {
      id: "demo-account-2",
      name: "Savings Account",
      balance: 25000,
      type: "savings",
      userId: "demo-user",
    },
  ];

  // Calculate net worth
  const totalAssets = totalBalance;
  const totalDebts = 5000;
  const netWorth = totalAssets - totalDebts;

  // Don't render until dates are available to avoid SSR issues
  if (!currentDate || !selectedMonthDate) {
    return null;
  }

  // Mock subscription data for demo
  // At this point, currentDate is guaranteed to be non-null
  const mockPlan = {
    id: "demo-plan",
    name: "pro" as const,
    priceMonthly: 0,
    priceYearly: 0,
    features: {
      ...getDefaultFeatures(),
      hasInvestments: true,
    },
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    stripeProductId: null,
    createdAt: currentDate,
    updatedAt: currentDate,
  };

  return (
    <SubscriptionProvider
      initialData={{
        subscription: {
          id: "demo-subscription",
          status: "active" as const,
          planId: "demo-plan",
          userId: "demo-user",
          householdId: null,
          stripeSubscriptionId: null,
          stripeCustomerId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          trialEndDate: null,
          cancelAtPeriodEnd: false,
          createdAt: currentDate,
          updatedAt: currentDate,
        },
        plan: mockPlan,
      }}
    >
      <div className="space-y-4 md:space-y-6">
        {/* Financial Overview Title */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-semibold">
            <span className="md:hidden">Overview</span>
            <span className="hidden md:inline">Financial Overview</span>
          </h2>
        </div>
        
        {/* Financial Summary - Full Width */}
        <SummaryCards
          selectedMonthTransactions={mockSelectedMonthTransactions}
          lastMonthTransactions={mockLastMonthTransactions}
          savings={savings}
          totalBalance={totalBalance}
          lastMonthTotalBalance={lastMonthTotalBalance}
          accounts={mockAccounts}
          selectedMemberId={null}
          householdMembers={[]}
          isLoadingMembers={false}
          financialHealth={mockFinancialHealth}
        />

        {/* Top Widgets - Spare Score and Expenses by Category side by side */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <FinancialHealthScoreWidget
            financialHealth={mockFinancialHealth}
            selectedMonthTransactions={mockSelectedMonthTransactions}
            lastMonthTransactions={mockLastMonthTransactions}
            expectedIncomeRange={null}
          />
          {/* Expenses by Category - Removed widget, using placeholder */}
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">Expenses by Category widget (demo placeholder)</p>
          </div>
        </div>

        {/* Budget Overview */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">Cash Flow Timeline widget (demo placeholder)</p>
          </div>
          <BudgetOverviewWidget
            budgets={mockBudgets}
          />
        </div>

        {/* Subscriptions, Recurring & Goals */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <SubscriptionsRecurringGoalsWidget
            subscriptions={mockSubscriptions}
            recurringPayments={mockRecurringPayments}
            goals={mockGoals}
          />
        </div>

        {/* Dashboard Grid */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Net Worth Snapshot and Investment Portfolio - side by side, full width */}
          <div className="col-span-full">
            <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
              <NetWorthWidget
                netWorth={netWorth}
                totalAssets={totalAssets}
                totalDebts={totalDebts}
              />
              <InvestmentPortfolioWidget
                savings={savings}
                demoMode={true}
              />
            </div>
          </div>
        </div>
      </div>
    </SubscriptionProvider>
  );
}

