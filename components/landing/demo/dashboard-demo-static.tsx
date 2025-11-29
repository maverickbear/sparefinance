"use client";

import { useMemo } from "react";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { FinancialSummaryWidget } from "@/app/(protected)/dashboard/widgets/financial-summary-widget";
import { FinancialHealthScoreWidget } from "@/app/(protected)/dashboard/widgets/financial-health-score-widget";
import { ExpensesByCategoryWidget } from "@/app/(protected)/dashboard/widgets/expenses-by-category-widget";
import { CashFlowTimelineWidget } from "@/app/(protected)/dashboard/widgets/cash-flow-timeline-widget";
import { BudgetStatusWidget } from "@/app/(protected)/dashboard/widgets/budget-status-widget";
import { RecurringPaymentsWidget } from "@/app/(protected)/dashboard/widgets/recurring-payments-widget";
import { SavingsGoalsWidget } from "@/app/(protected)/dashboard/widgets/savings-goals-widget";
import { SubscriptionsWidget } from "@/app/(protected)/dashboard/widgets/subscriptions-widget";
import { NetWorthWidget } from "@/app/(protected)/dashboard/widgets/net-worth-widget";
import { PortfolioPerformanceWidget } from "@/app/(protected)/dashboard/widgets/portfolio-performance-widget";
import { calculateTotalIncome, calculateTotalExpenses } from "@/app/(protected)/dashboard/utils/transaction-helpers";
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

const mockChartTransactions: TransactionWithRelations[] = [
  { id: "1", type: "income", amount: 5000, accountId: "demo-account-1", date: new Date(2024, 6, 1) },
  { id: "2", type: "expense", amount: -3200, accountId: "demo-account-1", date: new Date(2024, 6, 15) },
  { id: "3", type: "income", amount: 5500, accountId: "demo-account-1", date: new Date(2024, 7, 1) },
  { id: "4", type: "expense", amount: -3500, accountId: "demo-account-1", date: new Date(2024, 7, 15) },
  { id: "5", type: "income", amount: 6000, accountId: "demo-account-1", date: new Date(2024, 8, 1) },
  { id: "6", type: "expense", amount: -3800, accountId: "demo-account-1", date: new Date(2024, 8, 15) },
  { id: "7", type: "income", amount: 6500, accountId: "demo-account-1", date: new Date(2024, 9, 1) },
  { id: "8", type: "expense", amount: -4000, accountId: "demo-account-1", date: new Date(2024, 9, 15) },
  { id: "9", type: "income", amount: 7000, accountId: "demo-account-1", date: new Date(2024, 10, 1) },
  { id: "10", type: "expense", amount: -4200, accountId: "demo-account-1", date: new Date(2024, 10, 15) },
  { id: "11", type: "income", amount: 8000, accountId: "demo-account-1", date: new Date(2024, 11, 1) },
  { id: "12", type: "expense", amount: -3500, accountId: "demo-account-1", date: new Date(2024, 11, 15) },
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

const mockRecurringPayments = [
  {
    id: "1",
    date: new Date(2024, 11, 15),
    type: "expense" as const,
    amount: -1200,
    description: "Rent Payment",
    account: { id: "1", name: "Checking Account" },
    category: { id: "1", name: "Housing" },
  },
  {
    id: "2",
    date: new Date(2024, 11, 20),
    type: "expense" as const,
    amount: -350,
    description: "Electricity Bill",
    account: { id: "1", name: "Checking Account" },
    category: { id: "5", name: "Utilities" },
  },
  {
    id: "3",
    date: new Date(2024, 11, 1),
    type: "expense" as const,
    amount: -99,
    description: "Netflix",
    account: { id: "1", name: "Checking Account" },
    category: { id: "4", name: "Entertainment" },
    subcategory: { id: "1", name: "Streaming", logo: null },
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
  // Get current date for demo
  const currentDate = new Date();
  const selectedMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  // Calculate values using the same logic as the real dashboard
  const totalBalance = 30500;
  const savings = 25000;
  const lastMonthTotalBalance = 28000;
  const liabilities: any[] = [];
  const debts: any[] = [];

  // Calculate income and expenses using helper functions
  const currentIncome = useMemo(() => {
    return calculateTotalIncome(mockSelectedMonthTransactions);
  }, []);

  const currentExpenses = useMemo(() => {
    return calculateTotalExpenses(mockSelectedMonthTransactions);
  }, []);

  const lastMonthIncome = useMemo(() => {
    return calculateTotalIncome(mockLastMonthTransactions);
  }, []);

  const lastMonthExpenses = useMemo(() => {
    return calculateTotalExpenses(mockLastMonthTransactions);
  }, []);

  // Calculate net worth
  const totalAssets = totalBalance;
  const totalDebts = 5000;
  const netWorth = totalAssets - totalDebts;

  // Mock subscription data for demo
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        plan: mockPlan,
      }}
    >
      <div className="space-y-4 md:space-y-6">
        {/* Financial Overview Title */}
        <h2 className="text-2xl font-semibold">Financial Overview</h2>
        
        {/* Financial Summary - Full Width */}
        <FinancialSummaryWidget
          totalBalance={totalBalance}
          monthlyIncome={currentIncome}
          monthlyExpense={currentExpenses}
          totalSavings={savings}
          lastMonthIncome={lastMonthIncome}
          lastMonthExpense={lastMonthExpenses}
        />

        {/* Top Widgets - Spare Score and Expenses by Category side by side */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <FinancialHealthScoreWidget
            financialHealth={mockFinancialHealth}
            selectedMonthTransactions={mockSelectedMonthTransactions}
            lastMonthTransactions={mockLastMonthTransactions}
          />
          <ExpensesByCategoryWidget
            selectedMonthTransactions={mockSelectedMonthTransactions}
            selectedMonthDate={selectedMonthDate}
          />
        </div>

        {/* Cash Flow Timeline and Budget Status side by side */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <CashFlowTimelineWidget
            chartTransactions={mockChartTransactions}
            selectedMonthDate={selectedMonthDate}
          />
          <BudgetStatusWidget
            budgets={mockBudgets}
          />
        </div>

        {/* Recurring Payments and Savings Goals side by side */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <RecurringPaymentsWidget
            recurringPayments={mockRecurringPayments}
            monthlyIncome={currentIncome}
          />
          <SavingsGoalsWidget
            goals={mockGoals}
          />
        </div>

        {/* Subscriptions Widget - Full Width */}
        <SubscriptionsWidget
          subscriptions={mockSubscriptions}
        />

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
              <PortfolioPerformanceWidget
                savings={savings}
              />
            </div>
          </div>
        </div>
      </div>
    </SubscriptionProvider>
  );
}

