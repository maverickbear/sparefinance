/**
 * Domain types for dashboard widgets
 * Pure TypeScript types with no external dependencies
 */

// Common actionability types
export interface WidgetAction {
  label: string;
  href: string;
  variant: 'primary' | 'secondary' | 'link';
  icon?: string;
}

export interface WidgetInsight {
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
  actionHref?: string;
  actionLabel?: string;
}

export interface WidgetNextStep {
  priority: 'high' | 'medium' | 'low';
  description: string;
  href: string;
}

// Base widget data interface
export interface BaseWidgetData {
  actions: WidgetAction[];
  insights: WidgetInsight[];
  nextSteps?: WidgetNextStep[];
}

// Widget 1: Spare Score
export interface SpareScoreDriver {
  label: string;
  change: number; // percentage change
  changeType: 'increase' | 'decrease';
  impact: 'high' | 'medium' | 'low';
  actionHref: string;
}

export interface SpareScoreDetails {
  score: number;
  classification: "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
  monthlyIncome: number;
  monthlyExpenses: number;
  netAmount: number;
  savingsRate: number;
  message: string;
  spendingDiscipline: "Excellent" | "Good" | "Fair" | "Poor" | "Critical" | "Unknown";
  debtExposure: "Low" | "Moderate" | "High";
  emergencyFundMonths: number;
  alerts: Array<{
    id: string;
    title: string;
    description: string;
    severity: "critical" | "warning" | "info";
    action: string;
  }>;
  suggestions: Array<{
    id: string;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
  }>;
}

export interface SpareScoreWidgetData extends BaseWidgetData {
  score: number;
  classification: "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
  trend: 'up' | 'down' | 'stable';
  trendValue?: number; // percentage change from last month
  lastMonthScore?: number;
  topDrivers: SpareScoreDriver[];
  message: string;
  isProjected?: boolean;
  details?: SpareScoreDetails;
}

// Widget 2: Net Worth
export interface NetWorthDriver {
  type: 'assets' | 'liabilities';
  label: string;
  change: number;
  changePercentage: number;
}

export interface NetWorthWidgetData extends BaseWidgetData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  change: number;
  changePercentage: number;
  drivers: NetWorthDriver[];
  historical: Array<{
    date: string;
    netWorth: number;
  }>;
}

// Widget 3: Cash Flow
export interface CashFlowWidgetData extends BaseWidgetData {
  income: number;
  expenses: number;
  net: number;
  spendingRatio: number; // expenses as % of income
  comparison: {
    incomeChange: number; // percentage
    expensesChange: number; // percentage
    netChange: number; // percentage
    period: string; // e.g., "vs last month"
  };
}

// Widget 4: Budget Performance
export interface BudgetPerformanceCategory {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  difference: number;
  percentage: number; // actual as % of budgeted
  isOverspending: boolean;
}

export interface BudgetPerformanceWidgetData extends BaseWidgetData {
  categories: BudgetPerformanceCategory[];
  totalBudgeted: number;
  totalActual: number;
  totalDifference: number;
  period: string;
}

// Widget 5: Top Spending Categories
export interface TopSpendingCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number; // % of total spending
  delta: number; // change from last period
  deltaPercentage: number; // % change from last period
  hasBudget: boolean;
}

export interface TopSpendingCategoriesWidgetData extends BaseWidgetData {
  categories: TopSpendingCategory[];
  totalSpending: number;
  period: string;
  comparisonPeriod: string;
}

// Widget 6: Upcoming Payments
export interface UpcomingPayment {
  id: string;
  date: string;
  amount: number;
  description: string;
  category?: string;
  accountId: string;
  accountName?: string;
  isOverBudget: boolean; // if payment exceeds available balance
  daysUntil: number;
}

export interface UpcomingPaymentsWidgetData extends BaseWidgetData {
  payments: UpcomingPayment[];
  totalDue: number;
  totalDueNext7Days: number;
  period: string; // e.g., "next 30 days"
}

// Widget 7: Goals Progress
export interface GoalProgress {
  id: string;
  name: string;
  currentBalance: number;
  targetAmount: number;
  progressPercentage: number;
  monthsRemaining: number | null;
  monthlyContributionNeeded: number;
  isBehindSchedule: boolean;
}

export interface GoalsProgressWidgetData extends BaseWidgetData {
  goals: GoalProgress[];
  totalGoals: number;
  activeGoals: number;
}

// Widget 8: Financial Alerts
export interface FinancialAlert {
  id: string;
  type: 'emergency-fund' | 'overdraft-risk' | 'upcoming-shortfall' | 'budget-exceeded' | 'debt-high' | 'other';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  dismissible: boolean;
}

export interface FinancialAlertsWidgetData extends BaseWidgetData {
  alerts: FinancialAlert[];
  hasAlerts: boolean;
}

// Widget 9: Debt Overview
export interface DebtMilestone {
  debtId: string;
  debtName: string;
  monthsUntilMilestone: number;
  milestoneDescription: string;
}

export interface DebtOverviewWidgetData extends BaseWidgetData {
  totalDebt: number;
  monthlyPayments: number;
  payoffTimeline: number; // months until debt-free
  nextMilestone: DebtMilestone | null;
  totalDebts: number; // count of active debts
}

// Widget 10: Investment Portfolio
export interface AssetAllocation {
  assetClass: string;
  percentage: number;
  value: number;
  targetPercentage?: number;
}

export interface InvestmentPortfolioWidgetData extends BaseWidgetData {
  totalValue: number;
  allocation: AssetAllocation[];
  performanceYTD: number; // percentage
  performance1Y: number; // percentage
  targetAllocation?: AssetAllocation[];
  isOffTarget: boolean;
}

// Combined dashboard data
export interface DashboardWidgetsData {
  spareScore: SpareScoreWidgetData | null;
  netWorth: NetWorthWidgetData | null;
  cashFlow: CashFlowWidgetData | null;
  budgetPerformance: BudgetPerformanceWidgetData | null;
  topSpendingCategories: TopSpendingCategoriesWidgetData | null;
  upcomingPayments: UpcomingPaymentsWidgetData | null;
  goalsProgress: GoalsProgressWidgetData | null;
  financialAlerts: FinancialAlertsWidgetData;
  debtOverview: DebtOverviewWidgetData | null;
  investmentPortfolio: InvestmentPortfolioWidgetData | null;
  // New Widgets
  totalBudgets: TotalBudgetsWidgetData | null;
  spending: SpendingWidgetData | null;
  recentTransactions: RecentTransactionsWidgetData | null;
  recurring: RecurringWidgetData | null;
  investmentHoldings: InvestmentHoldingsWidgetData | null;
  subscriptions: SubscriptionsWidgetData | null;
  accountStats: {
    totalChecking: number;
    totalSavings: number;
  } | null;
}

// Widget: Total Budgets (Replacement for BudgetPerformance in new design)
export interface TotalBudgetsWidgetData extends BaseWidgetData {
  totalAmount: number;
  period: string; // e.g., "Expenses" or "Monthly"
  categories: {
    id: string;
    name: string;
    spent: number;
    budget: number;
    percentage: number; // of specific budget
    color: string;
    allocationPercentage: number; // of total budget
  }[];
}

// Widget: Spending This Month
export interface SpendingWidgetData extends BaseWidgetData {
  currentTotal: number;
  comparisonPeriod: string; // "This month vs. last month"
  series: {
    label: string; // "This month" or "Last month"
    data: { date: string; amount: number; cumulative: number }[];
    color: string;
  }[];
  categories: {
    id: string;
    name: string;
    value: number;
    color: string;
  }[];
}

// Widget: Recent Transactions (Simplified list)
export interface RecentTransactionItem {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string;
  type: 'income' | 'expense' | 'transfer';
  categoryColor?: string; // e.g. "Essential", "Lifestyle"
  icon?: string;
}

export interface RecentTransactionsWidgetData extends BaseWidgetData {
  transactions: RecentTransactionItem[];
}

// Widget: Investment Holdings (List view)
export interface InvestmentHoldingItem {
  symbol: string;
  name: string;
  value: number;
  change: number; // percentage
  changeValue: number;
}

export interface InvestmentHoldingsWidgetData extends BaseWidgetData {
  holdings: InvestmentHoldingItem[];
}

// Widget: Recurring (List view)
export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  frequency: string; // "Monthly", "Yearly"
  nextDate: string;
  icon?: string;
}

export interface RecurringWidgetData extends BaseWidgetData {
  items: RecurringItem[];
}

// Widget: Subscriptions
export interface SubscriptionItem {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  nextDate: string;
  logo?: string | null;
}

export interface SubscriptionsWidgetData extends BaseWidgetData {
  items: SubscriptionItem[];
  totalMonthly: number;
}
