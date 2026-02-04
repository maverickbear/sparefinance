"use client";

import { useState, useEffect } from "react";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { formatMoney } from "@/components/common/money";
import { getDefaultFeatures } from "@/lib/utils/plan-features";
import { 
  TotalBudgetsWidgetData, 
  SpendingWidgetData, 
  GoalsProgressWidgetData, 
  RecentTransactionsWidgetData,
  RecurringWidgetData,
  SubscriptionsWidgetData,
  SpareScoreWidgetData,
  NetWorthWidgetData
} from "@/src/domain/dashboard/types";

// Import actual widgets
import { TotalBudgetsWidget } from "@/src/presentation/components/features/dashboard/widgets/total-budgets-widget";
import { SpendingWidget } from "@/src/presentation/components/features/dashboard/widgets/spending-widget";
import { GoalsProgressWidget } from "@/src/presentation/components/features/dashboard/widgets/goals-progress-widget";
import { RecentTransactionsWidget } from "@/src/presentation/components/features/dashboard/widgets/recent-transactions-widget";
import { RecurringWidget } from "@/src/presentation/components/features/dashboard/widgets/recurring-widget";
import { SubscriptionsWidget } from "@/src/presentation/components/features/dashboard/widgets/subscriptions-widget";
import { WidgetCard } from "@/src/presentation/components/features/dashboard/widgets/widget-card";

// Mock Data
const mockAccountStats = {
  totalChecking: 8450.25,
  totalSavings: 25000.00,
};

const mockNetWorth: NetWorthWidgetData = {
  totalAssets: 33450.25,
  totalLiabilities: 4500.00,
  netWorth: 28950.25,
  change: 1250.00,
  changePercentage: 4.5,
  actions: [],
  insights: [],
  drivers: [],
  historical: []
};

const mockSpareScore: SpareScoreWidgetData = {
  score: 785,
  classification: "Excellent",
  trend: "up",
  trendValue: 12,
  message: "Your score is looking great!",
  topDrivers: [],
  actions: [],
  insights: []
};

const mockTotalBudgets: TotalBudgetsWidgetData = {
  totalAmount: 3200,
  period: "Monthly",
  categories: [
    { id: "1", name: "Food & Dining", spent: 850, budget: 1000, percentage: 85, color: "#f97316", allocationPercentage: 35 },
    { id: "2", name: "Housing", spent: 1500, budget: 1500, percentage: 100, color: "#3b82f6", allocationPercentage: 45 },
    { id: "3", name: "Shopping", spent: 420, budget: 400, percentage: 105, color: "#ec4899", allocationPercentage: 12 },
    { id: "4", name: "Transport", spent: 180, budget: 300, percentage: 60, color: "#10b981", allocationPercentage: 8 },
  ],
  actions: [],
  insights: []
};

const mockSpending: SpendingWidgetData = {
  currentTotal: 2950,
  comparisonPeriod: "this month vs. last month",
  series: [
    {
      label: "This month",
      color: "#f97316",
      data: [
         { date: "1", amount: 1500, cumulative: 1500 },
         { date: "5", amount: 200, cumulative: 1700 },
         { date: "10", amount: 450, cumulative: 2150 },
         { date: "15", amount: 300, cumulative: 2450 },
         { date: "20", amount: 150, cumulative: 2600 },
         { date: "25", amount: 350, cumulative: 2950 },
      ]
    },
    {
      label: "Last month",
      color: "#9ca3af",
      data: [
         { date: "1", amount: 1500, cumulative: 1500 },
         { date: "5", amount: 150, cumulative: 1650 },
         { date: "10", amount: 400, cumulative: 2050 },
         { date: "15", amount: 500, cumulative: 2550 },
         { date: "20", amount: 200, cumulative: 2750 },
         { date: "25", amount: 400, cumulative: 3150 },
      ]
    }
  ],
  categories: [
    { id: "2", name: "Housing", value: 1500, color: "#3b82f6" },
    { id: "1", name: "Food & Dining", value: 850, color: "#f97316" },
    { id: "3", name: "Shopping", value: 420, color: "#ec4899" },
    { id: "4", name: "Transport", value: 180, color: "#10b981" },
  ],
  actions: [],
  insights: []
};

const mockGoals: GoalsProgressWidgetData = {
  totalGoals: 3,
  activeGoals: 3,
  goals: [
    { 
      id: "1", 
      name: "Emergency Fund", 
      currentBalance: 8500, 
      targetAmount: 10000, 
      progressPercentage: 85, 
      monthsRemaining: 3, 
      monthlyContributionNeeded: 500, 
      isBehindSchedule: false 
    },
    { 
      id: "2", 
      name: "New Car", 
      currentBalance: 12000, 
      targetAmount: 25000, 
      progressPercentage: 48, 
      monthsRemaining: 12, 
      monthlyContributionNeeded: 1100, 
      isBehindSchedule: true 
    },
  ],
  actions: [],
  insights: []
};

const mockRecentTransactions: RecentTransactionsWidgetData = {
  transactions: [
    { id: "1", name: "Whole Foods Market", amount: -156.42, date: new Date().toISOString(), category: "Groceries", type: "expense", icon: "shopping-cart" },
    { id: "2", name: "Uber Trip", amount: -24.50, date: new Date(Date.now() - 86400000).toISOString(), category: "Transport", type: "expense", icon: "car" },
    { id: "3", name: "Salary Deposit", amount: 4200.00, date: new Date(Date.now() - 172800000).toISOString(), category: "Income", type: "income", icon: "dollar-sign" },
    { id: "4", name: "Netflix Subscription", amount: -15.99, date: new Date(Date.now() - 259200000).toISOString(), category: "Entertainment", type: "expense", icon: "tv" },
    { id: "5", name: "Shell Station", amount: -45.00, date: new Date(Date.now() - 345600000).toISOString(), category: "Transport", type: "expense", icon: "fuel" },
  ],
  actions: [],
  insights: []
};

const mockRecurring: RecurringWidgetData = {
  items: [
    { id: "1", name: "Rent", amount: 1500, frequency: "Monthly", nextDate: "In 2 days" },
    { id: "2", name: "Car Insurance", amount: 120, frequency: "Monthly", nextDate: "In 5 days" },
    { id: "3", name: "Internet Bill", amount: 65, frequency: "Monthly", nextDate: "In 12 days" },
  ],
  actions: [],
  insights: []
};

const mockSubscriptions: SubscriptionsWidgetData = {
  totalMonthly: 45.97,
  items: [
    { id: "1", name: "Netflix", amount: 15.99, frequency: "Monthly", nextDate: "Oct 15", logo: null },
    { id: "2", name: "Spotify", amount: 9.99, frequency: "Monthly", nextDate: "Oct 21", logo: null },
    { id: "3", name: "Adobe Creative Cloud", amount: 19.99, frequency: "Monthly", nextDate: "Oct 28", logo: null },
  ],
  actions: [],
  insights: []
};

export function DashboardDemoStatic() {
  // Get current date for demo - use state to avoid SSR issues
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Don't render until dates are available to avoid SSR issues
  if (!currentDate) {
    return null;
  }

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
      <div className="w-full">
        {/* Stats Section: 4 Columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 lg:mb-6">
           <WidgetCard title="Income" className="min-h-0 h-auto">
              <div className="flex flex-col gap-1">
                 <span className="text-xs text-muted-foreground">Current Checking Balance</span>
                 <div className="text-2xl font-bold">
                   {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(mockAccountStats.totalChecking)}
                 </div>
              </div>
           </WidgetCard>
           <WidgetCard title="Savings" className="min-h-0 h-auto">
              <div className="flex flex-col gap-1">
                 <span className="text-xs text-muted-foreground">Current Savings Balance</span>
                 <div className="text-2xl font-bold">
                   {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(mockAccountStats.totalSavings)}
                 </div>
              </div>
           </WidgetCard>
           <WidgetCard title="Net Worth" className="min-h-0 h-auto">
              <div className="flex flex-col gap-1">
                 <span className="text-xs text-muted-foreground">Current Net Position</span>
                 <div className="text-2xl font-bold">
                   {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(mockNetWorth.netWorth)}
                 </div>
              </div>
           </WidgetCard>
           <WidgetCard 
             title="Spare Score" 
             className="min-h-0 h-auto"
           >
              <div className="flex flex-col gap-1">
                 <span className="text-xs text-muted-foreground">Current Score</span>
                 <div className="text-2xl font-bold text-emerald-500">
                   {mockSpareScore.score}
                 </div>
              </div>
           </WidgetCard>
        </div>

        {/* Top Section: 2 Columns now (removed Add Transaction for demo to keep it simple/read-only) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-4 lg:mb-6">
           <TotalBudgetsWidget data={mockTotalBudgets} className="h-full" />
           <SpendingWidget data={mockSpending} className="h-full" />
        </div>

        {/* Existing Grid for remaining widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 auto-rows-fr">
           <GoalsProgressWidget data={mockGoals} className="h-full" />
           <RecentTransactionsWidget data={mockRecentTransactions} className="h-full" />
           
           <RecurringWidget data={mockRecurring} className="h-full" />
           <SubscriptionsWidget data={mockSubscriptions} className="h-full" />
        </div>
      </div>
    </SubscriptionProvider>
  );
}

