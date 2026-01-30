/**
 * Domain validations for dashboard widgets
 * Zod schemas for widget data validation
 */

import { z } from "zod";

// Common actionability schemas
export const widgetActionSchema = z.object({
  label: z.string(),
  href: z.string(),
  variant: z.enum(['primary', 'secondary', 'link']),
  icon: z.string().optional(),
});

export const widgetInsightSchema = z.object({
  type: z.enum(['info', 'warning', 'success', 'error']),
  message: z.string(),
  actionHref: z.string().optional(),
  actionLabel: z.string().optional(),
});

export const widgetNextStepSchema = z.object({
  priority: z.enum(['high', 'medium', 'low']),
  description: z.string(),
  href: z.string(),
});

// Widget-specific schemas
export const spareScoreDriverSchema = z.object({
  label: z.string(),
  change: z.number(),
  changeType: z.enum(['increase', 'decrease']),
  impact: z.enum(['high', 'medium', 'low']),
  actionHref: z.string(),
});

export const spareScoreWidgetDataSchema = z.object({
  score: z.number().min(0).max(100),
  classification: z.enum(["Excellent", "Good", "Fair", "Poor", "Critical"]),
  trend: z.enum(['up', 'down', 'stable']),
  trendValue: z.number().optional(),
  lastMonthScore: z.number().min(0).max(100).optional(),
  topDrivers: z.array(spareScoreDriverSchema),
  message: z.string(),
  isProjected: z.boolean().optional(),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const netWorthDriverSchema = z.object({
  type: z.enum(['assets', 'liabilities']),
  label: z.string(),
  change: z.number(),
  changePercentage: z.number(),
});

export const netWorthWidgetDataSchema = z.object({
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
  change: z.number(),
  changePercentage: z.number(),
  drivers: z.array(netWorthDriverSchema),
  historical: z.array(z.object({
    date: z.string(),
    netWorth: z.number(),
  })),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const cashFlowWidgetDataSchema = z.object({
  income: z.number(),
  expenses: z.number(),
  net: z.number(),
  spendingRatio: z.number(),
  comparison: z.object({
    incomeChange: z.number(),
    expensesChange: z.number(),
    netChange: z.number(),
    period: z.string(),
  }),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const budgetPerformanceCategorySchema = z.object({
  categoryId: z.string(),
  categoryName: z.string(),
  budgeted: z.number(),
  actual: z.number(),
  difference: z.number(),
  percentage: z.number(),
  isOverspending: z.boolean(),
});

export const budgetPerformanceWidgetDataSchema = z.object({
  categories: z.array(budgetPerformanceCategorySchema),
  totalBudgeted: z.number(),
  totalActual: z.number(),
  totalDifference: z.number(),
  period: z.string(),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const topSpendingCategorySchema = z.object({
  categoryId: z.string(),
  categoryName: z.string(),
  amount: z.number(),
  percentage: z.number(),
  delta: z.number(),
  deltaPercentage: z.number(),
  hasBudget: z.boolean(),
});

export const topSpendingCategoriesWidgetDataSchema = z.object({
  categories: z.array(topSpendingCategorySchema),
  totalSpending: z.number(),
  period: z.string(),
  comparisonPeriod: z.string(),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const upcomingPaymentSchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number(),
  description: z.string(),
  category: z.string().optional(),
  accountId: z.string(),
  accountName: z.string().optional(),
  isOverBudget: z.boolean(),
  daysUntil: z.number(),
});

export const upcomingPaymentsWidgetDataSchema = z.object({
  payments: z.array(upcomingPaymentSchema),
  totalDue: z.number(),
  totalDueNext7Days: z.number(),
  period: z.string(),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const goalProgressSchema = z.object({
  id: z.string(),
  name: z.string(),
  currentBalance: z.number(),
  targetAmount: z.number(),
  progressPercentage: z.number(),
  monthsRemaining: z.number().nullable(),
  monthlyContributionNeeded: z.number(),
  isBehindSchedule: z.boolean(),
});

export const goalsProgressWidgetDataSchema = z.object({
  goals: z.array(goalProgressSchema),
  totalGoals: z.number(),
  activeGoals: z.number(),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const financialAlertSchema = z.object({
  id: z.string(),
  type: z.enum(['emergency-fund', 'overdraft-risk', 'upcoming-shortfall', 'budget-exceeded', 'debt-high', 'other']),
  severity: z.enum(['critical', 'warning', 'info']),
  title: z.string(),
  description: z.string(),
  actionHref: z.string(),
  actionLabel: z.string(),
  dismissible: z.boolean(),
});

export const financialAlertsWidgetDataSchema = z.object({
  alerts: z.array(financialAlertSchema),
  hasAlerts: z.boolean(),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const debtMilestoneSchema = z.object({
  debtId: z.string(),
  debtName: z.string(),
  monthsUntilMilestone: z.number(),
  milestoneDescription: z.string(),
});

export const debtOverviewWidgetDataSchema = z.object({
  totalDebt: z.number(),
  monthlyPayments: z.number(),
  payoffTimeline: z.number(),
  nextMilestone: debtMilestoneSchema.nullable(),
  totalDebts: z.number(),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const assetAllocationSchema = z.object({
  assetClass: z.string(),
  percentage: z.number(),
  value: z.number(),
  targetPercentage: z.number().optional(),
});

export const investmentPortfolioWidgetDataSchema = z.object({
  totalValue: z.number(),
  allocation: z.array(assetAllocationSchema),
  performanceYTD: z.number(),
  performance1Y: z.number(),
  targetAllocation: z.array(assetAllocationSchema).optional(),
  isOffTarget: z.boolean(),
  actions: z.array(widgetActionSchema),
  insights: z.array(widgetInsightSchema),
  nextSteps: z.array(widgetNextStepSchema).optional(),
});

export const dashboardWidgetsDataSchema = z.object({
  spareScore: spareScoreWidgetDataSchema.nullable(),
  netWorth: netWorthWidgetDataSchema.nullable(),
  cashFlow: cashFlowWidgetDataSchema.nullable(),
  budgetPerformance: budgetPerformanceWidgetDataSchema.nullable(),
  topSpendingCategories: topSpendingCategoriesWidgetDataSchema.nullable(),
  upcomingPayments: upcomingPaymentsWidgetDataSchema.nullable(),
  goalsProgress: goalsProgressWidgetDataSchema.nullable(),
  financialAlerts: financialAlertsWidgetDataSchema,
  debtOverview: debtOverviewWidgetDataSchema.nullable(),
  investmentPortfolio: investmentPortfolioWidgetDataSchema.nullable(),
});
