"use server";

import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { getTransactionsInternal } from "./transactions";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { getAccounts } from "./accounts";
import { getDebts } from "./debts";
import { getUserLiabilities } from "./plaid/liabilities";
import { logger } from "@/lib/utils/logger";
import { getCurrentUserId } from "@/lib/api/feature-guard";

export interface FinancialHealthData {
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
  lastMonthScore?: number;
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

async function calculateFinancialHealthInternal(
  selectedDate?: Date,
  accessToken?: string,
  refreshToken?: string
): Promise<FinancialHealthData> {
  const date = selectedDate || new Date();
  const selectedMonth = startOfMonth(date);
  const selectedMonthEnd = endOfMonth(date);
  
  // Get transactions for selected month only (to match the cards at the top)
  // Call internal function directly to avoid reading cookies inside cached function
  const log = logger.withPrefix("calculateFinancialHealthInternal");

  const transactionsResult = await getTransactionsInternal(
    {
      startDate: selectedMonth,
      endDate: selectedMonthEnd,
    },
    accessToken,
    refreshToken
  );
  
  // Extract transactions array from result
  const transactions = Array.isArray(transactionsResult)
    ? transactionsResult
    : (transactionsResult?.transactions || []);
  
  // Only count income and expense transactions
  const monthlyIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount); // Ensure income is positive
    }, 0);
  
  const monthlyExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount); // Ensure expenses are positive
    }, 0);
  
  const netAmount = monthlyIncome - monthlyExpenses;
  
  // Handle case when there are no transactions
  if (transactions.length === 0 || (monthlyIncome === 0 && monthlyExpenses === 0)) {
    return {
      score: 0,
      classification: "Critical" as const,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      netAmount: 0,
      savingsRate: 0,
      message: "No transactions found for this month. Add income and expense transactions to calculate your Spare Score.",
      spendingDiscipline: "Unknown" as const,
      debtExposure: "Low" as const,
      emergencyFundMonths: 0,
      alerts: [{
        id: "no_transactions",
        title: "No Transactions",
        description: "You don't have any transactions for this month. Add income and expense transactions to get your Spare Score.",
        severity: "info" as const,
        action: "Add transactions to see your Spare Score.",
      }],
      suggestions: [{
        id: "add_transactions",
        title: "Add Transactions",
        description: "Start by adding your income and expense transactions for this month to calculate your Spare Score.",
        impact: "high" as const,
      }],
    };
  }
  
  // Calculate savings rate (net amount as percentage of income)
  // If no income, savings rate is 0 (or negative if expenses > 0)
  const savingsRate = monthlyIncome > 0 
    ? (netAmount / monthlyIncome) * 100 
    : monthlyExpenses > 0 
    ? -100 // If expenses but no income, savings rate is -100%
    : 0; // No income and no expenses
  
  // Calculate expense ratio (expenses as percentage of income)
  // This is the key metric for the new classification system
  let expenseRatio: number;
  if (monthlyIncome > 0) {
    expenseRatio = (monthlyExpenses / monthlyIncome) * 100;
  } else if (monthlyExpenses > 0) {
    // If expenses but no income, ratio is 100%+ (we'll cap it at 200% for calculation purposes)
    expenseRatio = 100;
  } else {
    // No income and no expenses
    expenseRatio = 0;
  }
  
  // Calculate score based on expense ratio
  // Score ranges from 0-100 based on expense ratio
  // 0-60% expense ratio = 100-91 score (Excellent)
  // 61-70% expense ratio = 90-81 score (Good)
  // 71-80% expense ratio = 80-71 score (Fair)
  // 81-90% expense ratio = 70-61 score (Poor)
  // 91-100%+ expense ratio = 60-0 score (Critical)
  let score: number;
  
  // Ensure expenseRatio is a valid number
  if (isNaN(expenseRatio) || !isFinite(expenseRatio)) {
    log.warn("Invalid expenseRatio for score calculation:", expenseRatio);
    score = 0;
  } else if (expenseRatio <= 60) {
    // Excellent: 0-60% expenses, score 100-91
    score = Math.max(91, 100 - (expenseRatio / 60) * 9);
  } else if (expenseRatio <= 70) {
    // Good: 61-70% expenses, score 90-81
    score = Math.max(81, 90 - ((expenseRatio - 60) / 10) * 9);
  } else if (expenseRatio <= 80) {
    // Fair: 71-80% expenses, score 80-71
    score = Math.max(71, 80 - ((expenseRatio - 70) / 10) * 9);
  } else if (expenseRatio <= 90) {
    // Poor: 81-90% expenses, score 70-61
    score = Math.max(61, 70 - ((expenseRatio - 80) / 10) * 9);
  } else {
    // Critical: 91-100%+ expenses, score 60-0
    // For ratios > 100%, we cap the score at 0
    const cappedRatio = Math.min(expenseRatio, 200); // Cap at 200% for calculation
    score = Math.max(0, 60 - ((cappedRatio - 90) / 10) * 60);
  }
  
  // Round score to nearest integer and ensure it's between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  // Determine classification based on expense ratio
  let classification: "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
  if (expenseRatio <= 60) classification = "Excellent";
  else if (expenseRatio <= 70) classification = "Good";
  else if (expenseRatio <= 80) classification = "Fair";
  else if (expenseRatio <= 90) classification = "Poor";
  else classification = "Critical";
  
  // Generate personalized message based on classification
  let message: string;
  switch (classification) {
    case "Excellent":
      message = "You're living below your means — great job!";
      break;
    case "Good":
    case "Fair":
      message = "Your expenses are balanced but close to your limit.";
      break;
    case "Poor":
    case "Critical":
      message = "Warning: you're spending more than you earn!";
      break;
    default:
      message = "";
  }
  
  // Identify alerts
  const alerts = identifyAlerts({
    monthlyIncome,
    monthlyExpenses,
    netAmount,
    savingsRate,
  });
  
  // Generate suggestions
  const suggestions = generateSuggestions({
    monthlyIncome,
    monthlyExpenses,
    netAmount,
    savingsRate,
    score,
    classification,
  });

  // Calculate last month's score
  let lastMonthScore: number | undefined;
  try {
    const lastMonth = subMonths(selectedMonth, 1);
    const lastMonthEnd = endOfMonth(lastMonth);
    const lastMonthTransactionsResult = await getTransactionsInternal(
      {
        startDate: lastMonth,
        endDate: lastMonthEnd,
      },
      accessToken,
      refreshToken
    );

    // Extract transactions array from result
    const lastMonthTransactions = Array.isArray(lastMonthTransactionsResult)
      ? lastMonthTransactionsResult
      : (lastMonthTransactionsResult?.transactions || []);

    const lastMonthIncome = lastMonthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        return sum + Math.abs(amount);
      }, 0);

    const lastMonthExpenses = lastMonthTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        return sum + Math.abs(amount);
      }, 0);

    if (lastMonthIncome > 0 || lastMonthExpenses > 0) {
      const lastMonthExpenseRatio = lastMonthIncome > 0
        ? (lastMonthExpenses / lastMonthIncome) * 100
        : lastMonthExpenses > 0
        ? 100
        : 0;

      // Calculate score using same logic
      if (lastMonthExpenseRatio <= 60) {
        lastMonthScore = Math.max(91, 100 - (lastMonthExpenseRatio / 60) * 9);
      } else if (lastMonthExpenseRatio <= 70) {
        lastMonthScore = Math.max(81, 90 - ((lastMonthExpenseRatio - 60) / 10) * 9);
      } else if (lastMonthExpenseRatio <= 80) {
        lastMonthScore = Math.max(71, 80 - ((lastMonthExpenseRatio - 70) / 10) * 9);
      } else if (lastMonthExpenseRatio <= 90) {
        lastMonthScore = Math.max(61, 70 - ((lastMonthExpenseRatio - 80) / 10) * 9);
      } else {
        lastMonthScore = Math.max(0, 60 - ((lastMonthExpenseRatio - 90) / 10) * 60);
      }
      lastMonthScore = Math.round(lastMonthScore);
    }
  } catch (error) {
    console.warn("⚠️ [calculateFinancialHealthInternal] Could not calculate last month score:", error);
  }

  // Calculate spending discipline based on savings rate
  // Excellent: >= 30%, Good: 20-29%, Fair: 10-19%, Poor: 0-9%, Critical: < 0%
  let spendingDiscipline: "Excellent" | "Good" | "Fair" | "Poor" | "Critical" | "Unknown";
  
  // Ensure savingsRate is a valid number
  if (isNaN(savingsRate) || !isFinite(savingsRate)) {
    log.warn("Invalid savingsRate for spending discipline calculation:", savingsRate);
    spendingDiscipline = "Unknown";
  } else if (savingsRate >= 30) {
    spendingDiscipline = "Excellent";
  } else if (savingsRate >= 20) {
    spendingDiscipline = "Good";
  } else if (savingsRate >= 10) {
    spendingDiscipline = "Fair";
  } else if (savingsRate >= 0) {
    spendingDiscipline = "Poor";
  } else {
    spendingDiscipline = "Critical";
  }

  // Calculate debt exposure
  let debtExposure: "Low" | "Moderate" | "High" = "Low";
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (userId) {
      // Get total debts
      const debts = await getDebts();
      const liabilities = await getUserLiabilities(userId);

      let totalDebts = 0;

      // Calculate from Debt table (only debts that are not paid off)
      const debtsTotal = debts
        .filter((debt) => !debt.isPaidOff)
        .reduce((sum, debt) => {
          const balance = debt.currentBalance ?? 0;
          return sum + Math.abs(Number(balance) || 0);
        }, 0);
      totalDebts += debtsTotal;

      // Calculate from PlaidLiabilities
      const liabilitiesTotal = liabilities.reduce((sum, liability) => {
        const balance = (liability as any).balance ?? (liability as any).currentBalance ?? null;
        if (balance == null) return sum;
        const numValue = typeof balance === 'string' ? parseFloat(balance) : Number(balance);
        if (!isNaN(numValue) && isFinite(numValue)) {
          // For debts, we want the absolute value (a balance of -1000 means debt of 1000)
          // But if it's already positive, use it as-is
          const debtAmount = numValue < 0 ? Math.abs(numValue) : numValue;
          return sum + debtAmount;
        }
        return sum;
      }, 0);
      totalDebts += liabilitiesTotal;

      // Calculate debt-to-income ratio (annual)
      const annualIncome = monthlyIncome * 12;
      const debtToIncomeRatio = annualIncome > 0 ? (totalDebts / annualIncome) * 100 : 0;

      // Low: < 20%, Moderate: 20-40%, High: > 40%
      if (debtToIncomeRatio >= 40) {
        debtExposure = "High";
      } else if (debtToIncomeRatio >= 20) {
        debtExposure = "Moderate";
      } else {
        debtExposure = "Low";
      }
    }
  } catch (error) {
    console.warn("⚠️ [calculateFinancialHealthInternal] Could not calculate debt exposure:", error);
  }

  // Calculate emergency fund months
  let emergencyFundMonths = 0;
  try {
    const accounts = await getAccounts(accessToken, refreshToken);
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    
    // Emergency fund months = total balance / monthly expenses
    if (monthlyExpenses > 0) {
      emergencyFundMonths = totalBalance / monthlyExpenses;
    }
  } catch (error) {
    console.warn("⚠️ [calculateFinancialHealthInternal] Could not calculate emergency fund months:", error);
  }
  
  const result = {
    score,
    classification,
    monthlyIncome,
    monthlyExpenses,
    netAmount,
    savingsRate,
    message,
    spendingDiscipline,
    debtExposure,
    emergencyFundMonths,
    lastMonthScore,
    alerts,
    suggestions,
  };
  
  return result;
}

export async function calculateFinancialHealth(
  selectedDate?: Date,
  userId?: string | null,
  accessToken?: string,
  refreshToken?: string
): Promise<FinancialHealthData> {
  const log = logger.withPrefix("calculateFinancialHealth");
  
  // Get userId if not provided (for direct calls outside cache)
  let finalUserId = userId;
  if (!finalUserId) {
    try {
      finalUserId = await getCurrentUserId();
    } catch (error: any) {
      // If we can't get userId (e.g., inside unstable_cache), continue without it
      // The cache key will be less specific but still functional
      log.warn("Could not get userId:", error?.message);
    }
  }
  
  // Get tokens if not provided (for direct calls outside cache)
  let finalAccessToken = accessToken;
  let finalRefreshToken = refreshToken;
  
  if (!finalAccessToken || !finalRefreshToken) {
    try {
      const { createServerClient } = await import("@/lib/supabase-server");
      const supabase = await createServerClient();
      // SECURITY: Use getUser() first to verify authentication, then getSession() for tokens
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Only get session tokens if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          finalAccessToken = finalAccessToken || session.access_token;
          finalRefreshToken = finalRefreshToken || session.refresh_token;
        }
      }
    } catch (error: any) {
      // If we can't get tokens (e.g., inside unstable_cache), continue without them
      log.warn("Could not get tokens:", error?.message);
    }
  }
  
  // Use cache with userId in key to ensure proper isolation (if available)
  // Cache for 60 seconds to reduce load while keeping data relatively fresh
  const date = selectedDate || new Date();
  const cacheKey = finalUserId 
    ? `financial-health-${finalUserId}-${date.getFullYear()}-${date.getMonth()}`
    : `financial-health-${date.getFullYear()}-${date.getMonth()}`;
  
  try {
    const result = await unstable_cache(
      async () => calculateFinancialHealthInternal(selectedDate, finalAccessToken, finalRefreshToken),
      [cacheKey],
      { 
        revalidate: 60, // 60 seconds
        tags: ['financial-health', 'transactions', 'dashboard'] 
      }
    )();
    
    // Validate result before returning
    if (result.score === undefined || isNaN(result.score) || !isFinite(result.score)) {
      log.error("Invalid score calculated:", result.score);
      throw new Error("Invalid score calculated");
    }
    
    // Only warn if spendingDiscipline is Unknown AND we have data (indicates a calculation issue)
    // If there's no data (monthlyIncome === 0 and monthlyExpenses === 0), Unknown is expected
    if ((!result.spendingDiscipline || result.spendingDiscipline === "Unknown") && 
        (result.monthlyIncome > 0 || result.monthlyExpenses > 0)) {
      log.warn("Spending discipline is Unknown despite having transaction data, this may indicate a calculation issue");
    }
    
    return result;
  } catch (error: any) {
    log.error("Error calculating financial health:", error);
    // Return a default/empty financial health data instead of throwing
    // This prevents the entire dashboard from failing
    return {
      score: 0,
      classification: "Critical" as const,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      netAmount: 0,
      savingsRate: 0,
      message: "Unable to calculate Spare Score at this time. Please check your transactions.",
      spendingDiscipline: "Unknown" as const,
      debtExposure: "Low" as const,
      emergencyFundMonths: 0,
      alerts: [],
      suggestions: [],
    };
  }
}


function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function identifyAlerts(data: {
  monthlyIncome: number;
  monthlyExpenses: number;
  netAmount: number;
  savingsRate: number;
}): Array<{
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  action: string;
}> {
  const alerts = [];
  
  // Expenses exceeding income
  if (data.monthlyExpenses > data.monthlyIncome) {
    const excessPercentage = ((data.monthlyExpenses / data.monthlyIncome - 1) * 100).toFixed(1);
    alerts.push({
      id: "expenses_exceeding_income",
      title: "Expenses Exceeding Income",
      description: `Your monthly expenses (${formatMoney(data.monthlyExpenses)}) are ${excessPercentage}% higher than your monthly income (${formatMoney(data.monthlyIncome)}).`,
      severity: "critical" as const,
      action: "Review your expenses and identify where you can reduce costs.",
    });
  }
  
  // Negative savings rate
  if (data.savingsRate < 0) {
    alerts.push({
      id: "negative_savings_rate",
      title: "Negative Savings Rate",
      description: `You are spending ${formatMoney(Math.abs(data.netAmount))} more than you earn per month.`,
      severity: "critical" as const,
      action: "Create a strict budget and increase your income or reduce expenses.",
    });
  }
  
  // Low savings rate (but positive)
  if (data.savingsRate > 0 && data.savingsRate < 10) {
    alerts.push({
      id: "low_savings_rate",
      title: "Low Savings Rate",
      description: `You are saving only ${data.savingsRate.toFixed(1)}% of your income (${formatMoney(data.netAmount)}/month).`,
      severity: "warning" as const,
      action: "Try to increase your savings rate to at least 20%.",
    });
  }
  
  // Very low savings rate (positive but < 5%)
  if (data.savingsRate > 0 && data.savingsRate < 5) {
    alerts.push({
      id: "very_low_savings_rate",
      title: "Very Low Savings Rate",
      description: `Your savings rate of ${data.savingsRate.toFixed(1)}% is below recommended.`,
      severity: "info" as const,
      action: "Consider reviewing your expenses to increase your savings capacity.",
    });
  }
  
  return alerts;
}

function generateSuggestions(data: {
  monthlyIncome: number;
  monthlyExpenses: number;
  netAmount: number;
  savingsRate: number;
  score: number;
  classification: string;
}): Array<{
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
}> {
  const suggestions = [];
  
  // High impact suggestions
  if (data.monthlyExpenses > data.monthlyIncome) {
    const reductionNeeded = data.monthlyExpenses - data.monthlyIncome;
    suggestions.push({
      id: "reduce_expenses",
      title: "Urgently Reduce Expenses",
      description: `You need to reduce ${formatMoney(reductionNeeded)} per month to balance your income and expenses.`,
      impact: "high" as const,
    });
  }
  
  if (data.savingsRate < 0) {
    suggestions.push({
      id: "increase_income_or_reduce_expenses",
      title: "Increase Income or Reduce Expenses",
      description: `You are spending ${formatMoney(Math.abs(data.netAmount))} more than you earn. Prioritize increasing your income or reducing expenses.`,
      impact: "high" as const,
    });
  }
  
  if (data.savingsRate >= 0 && data.savingsRate < 10) {
    const targetSavings = data.monthlyIncome * 0.2;
    suggestions.push({
      id: "increase_savings_rate",
      title: "Increase Savings Rate",
      description: `Try to save at least 20% of your income. This means saving ${formatMoney(targetSavings)} per month.`,
      impact: "high" as const,
    });
  }
  
  // Medium impact suggestions
  if (data.savingsRate >= 10 && data.savingsRate < 20) {
    suggestions.push({
      id: "review_spending",
      title: "Review Expenses",
      description: "Analyze your expense categories and identify where you can reduce without affecting your quality of life.",
      impact: "medium" as const,
    });
  }
  
  if (data.monthlyExpenses > data.monthlyIncome * 0.9) {
    suggestions.push({
      id: "create_budget",
      title: "Create Budget",
      description: "Create a detailed budget to better control your expenses and ensure you save regularly.",
      impact: "medium" as const,
    });
  }
  
  // Low impact suggestions
  if (data.savingsRate >= 20 && data.savingsRate < 30) {
    suggestions.push({
      id: "optimize_savings",
      title: "Optimize Savings",
      description: "You're on the right track! Consider automating your savings and investing in low-risk applications.",
      impact: "low" as const,
    });
  }
  
  if (data.savingsRate >= 30) {
    suggestions.push({
      id: "maintain_good_habits",
      title: "Maintain Good Practices",
      description: "Excellent! You're maintaining a very healthy savings rate. Keep it up!",
      impact: "low" as const,
    });
  }
  
  return suggestions;
}
