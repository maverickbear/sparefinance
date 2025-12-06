"use server";
import { cookies } from "next/headers";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { logger } from "@/src/infrastructure/utils/logger";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
// CRITICAL: Use static import to ensure React cache() works correctly
import { getAccountsForDashboard } from "@/src/application/accounts/get-dashboard-accounts";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { makeBudgetRulesService } from "@/src/application/budgets/budget-rules.factory";
import { makeBudgetsService } from "@/src/application/budgets/budgets.factory";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
import { BudgetRuleProfile, BudgetRuleType } from "../../domain/budgets/budget-rules.types";
import { AppError } from "./app-error";

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
  isProjected?: boolean; // Flag indicating if this is a projected score based on expected income
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
  refreshToken?: string,
  accounts?: any[], // OPTIMIZED: Accept accounts to avoid duplicate getAccounts() call
  projectedIncome?: number, // Optional projected income for initial score calculation
  budgetRule?: BudgetRuleProfile // Optional budget rule for validation
): Promise<FinancialHealthData> {
  const date = selectedDate || new Date();
  const selectedMonth = startOfMonth(date);
  const selectedMonthEnd = endOfMonth(date);
  
  // Get transactions for selected month only (to match the cards at the top)
  // Call internal function directly to avoid reading cookies inside cached function
  const log = logger.withPrefix("calculateFinancialHealthInternal");

  const transactionsService = makeTransactionsService();
  const transactionsResult = await transactionsService.getTransactions(
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
  
  // Only count income and expense transactions (exclude transfers)
  let monthlyIncome = transactions
    .filter((t) => {
      // Exclude transfers (transactions with type 'transfer' or with transferFromId/transferToId)
      const isTransfer = t.type === "transfer" || !!(t as any).transferFromId || !!(t as any).transferToId;
      return t.type === "income" && !isTransfer;
    })
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount); // Ensure income is positive
    }, 0);

  // Adjust income to after-tax if location is available
  if (monthlyIncome > 0 && accessToken && refreshToken) {
    try {
      const { createServerClient } = await import("@/src/infrastructure/database/supabase-server");
      const supabase = await createServerClient(accessToken, refreshToken);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { getActiveHouseholdId } = await import("@/lib/utils/household");
        const householdId = await getActiveHouseholdId(user.id, accessToken, refreshToken);
        
        if (householdId) {
          const { HouseholdRepository } = await import("@/src/infrastructure/database/repositories/household.repository");
          const householdRepository = new HouseholdRepository();
          const settings = await householdRepository.getSettings(householdId, accessToken, refreshToken);
          
          if (settings?.country && settings?.stateOrProvince) {
            const { makeTaxesService } = await import("../taxes/taxes.factory");
            const taxesService = makeTaxesService();
            const annualIncome = monthlyIncome * 12;
            const monthlyAfterTax = await taxesService.calculateMonthlyAfterTaxIncome(
              settings.country,
              annualIncome,
              settings.stateOrProvince
            );
            monthlyIncome = monthlyAfterTax;
            log.debug(`[calculateFinancialHealthInternal] Using after-tax income: $${monthlyAfterTax.toFixed(2)}/month (from $${(annualIncome / 12).toFixed(2)}/month gross)`);
          }
        }
      }
    } catch (error) {
      log.warn(`[calculateFinancialHealthInternal] Failed to calculate after-tax income, using gross income:`, error);
      // Continue with gross income if tax calculation fails
    }
  }
  
  const monthlyExpenses = transactions
    .filter((t) => {
      // Exclude transfers (transactions with type 'transfer' or with transferFromId/transferToId)
      const isTransfer = t.type === "transfer" || !!(t as any).transferFromId || !!(t as any).transferToId;
      return t.type === "expense" && !isTransfer;
    })
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount); // Ensure expenses are positive
    }, 0);
  
  const netAmount = monthlyIncome - monthlyExpenses;
  
  // Handle case when there are no transactions
  if (transactions.length === 0 || (monthlyIncome === 0 && monthlyExpenses === 0)) {
    // If we have projected income, calculate projected score
    if (projectedIncome && projectedIncome > 0) {
      const projectedExpenses = projectedIncome * 0.8; // 80% of income
      const projectedNet = projectedIncome - projectedExpenses;
      const projectedSavingsRate = (projectedNet / projectedIncome) * 100;
      const expenseRatio = (projectedExpenses / projectedIncome) * 100;

      // Calculate score based on expense ratio (same logic as below)
      let score: number;
      if (expenseRatio <= 60) {
        score = 100 - (expenseRatio / 60) * 9; // 100-91
      } else if (expenseRatio <= 70) {
        score = 90 - ((expenseRatio - 60) / 10) * 9; // 90-81
      } else if (expenseRatio <= 80) {
        score = 80 - ((expenseRatio - 70) / 10) * 9; // 80-71
      } else if (expenseRatio <= 90) {
        score = 70 - ((expenseRatio - 80) / 10) * 9; // 70-61
      } else {
        score = 60 - ((expenseRatio - 90) / 10) * 60; // 60-0
      }

      let classification: "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
      if (score >= 91) {
        classification = "Excellent";
      } else if (score >= 81) {
        classification = "Good";
      } else if (score >= 71) {
        classification = "Fair";
      } else if (score >= 61) {
        classification = "Poor";
      } else {
        classification = "Critical";
      }

      let spendingDiscipline: "Excellent" | "Good" | "Fair" | "Poor" | "Critical" | "Unknown";
      if (expenseRatio <= 60) {
        spendingDiscipline = "Excellent";
      } else if (expenseRatio <= 70) {
        spendingDiscipline = "Good";
      } else if (expenseRatio <= 80) {
        spendingDiscipline = "Fair";
      } else if (expenseRatio <= 90) {
        spendingDiscipline = "Poor";
      } else {
        spendingDiscipline = "Critical";
      }

      return {
        score: Math.round(score),
        classification,
        monthlyIncome: projectedIncome,
        monthlyExpenses: projectedExpenses,
        netAmount: projectedNet,
        savingsRate: projectedSavingsRate,
        message: "This is a projected score based on your expected income. Connect your bank account to see your actual Spare Score.",
        spendingDiscipline,
        debtExposure: "Low" as const,
        emergencyFundMonths: 0,
        isProjected: true,
        alerts: [{
          id: "projected_score",
          title: "Projected Score",
          description: "This score is based on your expected income. Connect your bank account to see your actual financial health.",
          severity: "info" as const,
          action: "Connect your bank account to get started.",
        }],
        suggestions: [{
          id: "connect_account",
          title: "Connect Your Bank Account",
          description: "Connect your bank account to see your actual transactions and get personalized insights.",
          impact: "high" as const,
        }],
      };
    }

    // No projected income, return default empty state
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
  let alerts = identifyAlerts({
    monthlyIncome,
    monthlyExpenses,
    netAmount,
    savingsRate,
  });
  
  // Validate against budget rule if provided
  if (budgetRule && monthlyIncome > 0 && transactions.length > 0) {
    try {
      const budgetRulesService = makeBudgetRulesService();
      const budgetsService = makeBudgetsService();
      const categoriesService = makeCategoriesService();
      
      // Get budgets for the period
      const budgets = await budgetsService.getBudgets(selectedMonth, accessToken, refreshToken);
      
      // Get groups to map to rule categories
      const groups = await categoriesService.getGroups();
      const groupMappings = budgetRulesService.mapGroupsToRuleCategories(groups);
      
      // Get categories to build category-to-group map
      const allCategories = await categoriesService.getAllCategories();
      const categoriesMap = new Map<string, { groupId?: string | null }>();
      for (const category of allCategories) {
        categoriesMap.set(category.id, { groupId: category.groupId });
      }
      
      // Validate budgets against rule
      const validation = budgetRulesService.validateBudgetAgainstRule(
        budgets,
        transactions,
        budgetRule,
        monthlyIncome,
        groupMappings,
        categoriesMap
      );
      
      // Add rule-based alerts to existing alerts
      if (validation.alerts.length > 0) {
        const ruleAlerts = validation.alerts.map(alert => ({
          id: alert.id,
          title: alert.title,
          description: alert.description,
          severity: alert.severity,
          action: `Target: ${alert.targetPercentage.toFixed(0)}%, Actual: ${alert.actualPercentage.toFixed(1)}%`,
        }));
        alerts = [...alerts, ...ruleAlerts];
      }
    } catch (error) {
      // Log but don't fail if rule validation fails
      log.warn("Error validating budget rule:", error);
    }
  }
  
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
    const lastMonthTransactionsResult = await transactionsService.getTransactions(
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
      .filter((t) => {
        // Exclude transfers (transactions with type 'transfer' or with transferFromId/transferToId)
        const isTransfer = t.type === "transfer" || !!(t as any).transferFromId || !!(t as any).transferToId;
        return t.type === "income" && !isTransfer;
      })
      .reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        return sum + Math.abs(amount);
      }, 0);

    const lastMonthExpenses = lastMonthTransactions
      .filter((t) => {
        // Exclude transfers (transactions with type 'transfer' or with transferFromId/transferToId)
        const isTransfer = t.type === "transfer" || !!(t as any).transferFromId || !!(t as any).transferToId;
        return t.type === "expense" && !isTransfer;
      })
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
      const debtsService = makeDebtsService();
      const debts = await debtsService.getDebts(accessToken, refreshToken);

      let totalDebts = 0;

      // Calculate from Debt table (only debts that are not paid off)
      const debtsTotal = debts
        .filter((debt) => !debt.isPaidOff)
        .reduce((sum, debt) => {
          const balance = debt.currentBalance ?? 0;
          return sum + Math.abs(Number(balance) || 0);
        }, 0);
      totalDebts += debtsTotal;

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
  // Priority: Always use the system Goal "Emergency Funds" if it exists
  // Otherwise, fall back to total balance calculation
  let emergencyFundMonths = 0;
  let emergencyFundGoal: any = null;
  const RECOMMENDED_MONTHS = 6; // Minimum recommended emergency fund months
  
  // CRITICAL OPTIMIZATION: Use provided accounts to avoid duplicate getAccounts() calls
  // Only fetch accounts if absolutely necessary (not provided or empty)
  let accountsToUse = accounts && accounts.length > 0 ? accounts : null;
  
  try {
    // First, try to get emergency fund goal from system
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Get active household ID (pass tokens to ensure proper auth context for RLS)
      const { getActiveHouseholdId } = await import("@/lib/utils/household");
      const householdId = await getActiveHouseholdId(user.id, accessToken, refreshToken);
      
      if (householdId) {
        const { data: goal } = await supabase
          .from("Goal")
          .select("*")
          .eq("householdId", householdId)
          .eq("name", "Emergency Funds")
          .eq("isSystemGoal", true)
          .maybeSingle();
        
        emergencyFundGoal = goal;
        
        // If emergency fund goal exists, always use its currentBalance
        // This is the preferred method - use the Goal value from the system
        if (emergencyFundGoal) {
          const goalBalance = emergencyFundGoal.currentBalance || 0;
          if (monthlyExpenses > 0) {
            emergencyFundMonths = goalBalance / monthlyExpenses;
          }
        } else {
          // Fallback to total balance calculation - use provided accounts
          if (!accountsToUse) {
            // CRITICAL: Use cached getAccountsForDashboard to avoid duplicate calls
            const { getAccountsForDashboard } = await import("../accounts/get-dashboard-accounts");
            accountsToUse = await getAccountsForDashboard(true);
          }
          
          const totalBalance = accountsToUse?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ?? 0;
          
          // Emergency fund months = total balance / monthly expenses
          if (monthlyExpenses > 0) {
            emergencyFundMonths = totalBalance / monthlyExpenses;
          }
        }
      } else {
        // No household, use total balance calculation - use provided accounts
        if (!accountsToUse) {
          // CRITICAL: Use cached getAccountsForDashboard to avoid duplicate calls
          accountsToUse = await getAccountsForDashboard(true);
        }
        
        const totalBalance = accountsToUse?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ?? 0;
        
        if (monthlyExpenses > 0) {
          emergencyFundMonths = totalBalance / monthlyExpenses;
        }
      }
    } else {
      // No user, use total balance calculation - use provided accounts
      if (!accountsToUse) {
        // CRITICAL: Use cached getAccountsForDashboard to avoid duplicate calls
        accountsToUse = await getAccountsForDashboard(true);
      }
      
      const totalBalance = accountsToUse?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ?? 0;
      
      if (monthlyExpenses > 0) {
        emergencyFundMonths = totalBalance / monthlyExpenses;
      }
    }
  } catch (error) {
    console.warn("⚠️ [calculateFinancialHealthInternal] Could not calculate emergency fund months:", error);
    // Fallback: use provided accounts if available
    if (accountsToUse && monthlyExpenses > 0) {
      const totalBalance = accountsToUse.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      emergencyFundMonths = totalBalance / monthlyExpenses;
    }
  }
  
  // Adjust score based on Emergency Fund status
  // This considers:
  // 1. If the user has the Emergency Funds Goal
  // 2. If they meet the recommended minimum (6 months)
  // 3. The target amount set in the Goal
  let emergencyFundAdjustment = 0;
  
  if (!emergencyFundGoal) {
    // No Emergency Fund Goal exists: penalize score by 10 points
    emergencyFundAdjustment = -10;
    log.debug("Emergency Fund Goal not found - penalizing score by 10 points");
  } else {
    // Emergency Fund Goal exists - check if it meets recommendations
    const targetAmount = emergencyFundGoal.targetAmount || 0;
    const currentBalance = emergencyFundGoal.currentBalance || 0;
    
    // Calculate target months based on goal target amount
    const targetMonths = monthlyExpenses > 0 ? targetAmount / monthlyExpenses : 0;
    
    // Check if current balance meets recommended minimum (6 months)
    if (emergencyFundMonths >= RECOMMENDED_MONTHS) {
      // Meets or exceeds recommended minimum: bonus points
      if (emergencyFundMonths >= 12) {
        // Excellent: 12+ months - bonus of 10 points
        emergencyFundAdjustment = 10;
        log.debug(`Emergency Fund excellent (${emergencyFundMonths.toFixed(1)} months) - bonus +10 points`);
      } else {
        // Good: 6-12 months - bonus of 5 points
        emergencyFundAdjustment = 5;
        log.debug(`Emergency Fund good (${emergencyFundMonths.toFixed(1)} months) - bonus +5 points`);
      }
    } else {
      // Below recommended minimum: penalize based on how far below
      // Penalty ranges from -1 to -9 points based on coverage
      const monthsBelow = RECOMMENDED_MONTHS - emergencyFundMonths;
      const penaltyPercentage = Math.min(monthsBelow / RECOMMENDED_MONTHS, 1); // Max 100% penalty
      emergencyFundAdjustment = Math.round(-9 * penaltyPercentage) - 1; // -1 to -10 points
      log.debug(`Emergency Fund below minimum (${emergencyFundMonths.toFixed(1)} months, need ${RECOMMENDED_MONTHS}) - penalty ${emergencyFundAdjustment} points`);
    }
    
    // Additional check: if target is set but not reached, apply small additional penalty
    if (targetAmount > 0 && currentBalance < targetAmount) {
      const progressToTarget = currentBalance / targetAmount;
      if (progressToTarget < 0.5) {
        // Less than 50% of target: additional -2 points
        emergencyFundAdjustment -= 2;
        log.debug(`Emergency Fund less than 50% of target - additional -2 points`);
      }
    }
  }
  
  // Apply emergency fund adjustment to score
  score = Math.max(0, Math.min(100, score + emergencyFundAdjustment));
  
  // Recalculate classification if score changed significantly
  // This ensures classification reflects the adjusted score
  if (score >= 91) {
    classification = "Excellent";
  } else if (score >= 81) {
    classification = "Good";
  } else if (score >= 71) {
    classification = "Fair";
  } else if (score >= 61) {
    classification = "Poor";
  } else {
    classification = "Critical";
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
  refreshToken?: string,
  accounts?: any[], // OPTIMIZED: Accept accounts to avoid duplicate getAccounts() call
  projectedIncome?: number, // Optional projected income for initial score calculation
  budgetRule?: BudgetRuleProfile // Optional budget rule for validation
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
  
  try {
    const result = await calculateFinancialHealthInternal(selectedDate, finalAccessToken, finalRefreshToken, accounts, projectedIncome, budgetRule);
    
    // Validate result before returning
    if (result.score === undefined || isNaN(result.score) || !isFinite(result.score)) {
      log.error("Invalid score calculated:", result.score);
      throw new AppError("Invalid score calculated", 500);
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


/**
 * Recalculate financial health metrics from a pre-filtered list of transactions.
 * This is useful when you want to calculate financial health using only past transactions
 * (excluding future/scheduled transactions).
 * 
 * Note: This function recalculates income, expenses, score, and emergency fund months.
 * Debt exposure is preserved from the original financial health data.
 * Emergency fund months is recalculated using the system Goal "Emergency Funds" if available.
 * 
 * @param transactions - Pre-filtered list of transactions (e.g., only past transactions)
 * @param originalFinancialHealth - Original financial health data to preserve debt exposure
 * @param accessToken - Optional access token for authentication
 * @param refreshToken - Optional refresh token for authentication
 * @param accounts - Optional accounts array to avoid duplicate fetching
 * @returns Updated financial health data with recalculated metrics based on the provided transactions
 */
export async function recalculateFinancialHealthFromTransactions(
  transactions: any[],
  originalFinancialHealth: FinancialHealthData | null,
  accessToken?: string,
  refreshToken?: string,
  accounts?: any[]
): Promise<FinancialHealthData | null> {
  // If no original financial health data, return null
  if (!originalFinancialHealth) {
    return null;
  }
  // Only count income and expense transactions (exclude transfers)
  let monthlyIncome = transactions
    .filter((t) => {
      const isTransfer = t.type === "transfer" || !!(t as any).transferFromId || !!(t as any).transferToId;
      return t.type === "income" && !isTransfer;
    })
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount);
    }, 0);

  // Adjust income to after-tax if location is available
  if (monthlyIncome > 0 && accessToken && refreshToken) {
    try {
      const { createServerClient } = await import("@/src/infrastructure/database/supabase-server");
      const supabaseClient = await createServerClient(accessToken, refreshToken);
      const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
      
      if (currentUser) {
        const { getActiveHouseholdId } = await import("@/lib/utils/household");
        const householdId = await getActiveHouseholdId(currentUser.id, accessToken, refreshToken);
        
        if (householdId) {
          const { HouseholdRepository } = await import("@/src/infrastructure/database/repositories/household.repository");
          const householdRepository = new HouseholdRepository();
          const settings = await householdRepository.getSettings(householdId, accessToken, refreshToken);
          
          if (settings?.country && settings?.stateOrProvince) {
            const { makeTaxesService } = await import("../taxes/taxes.factory");
            const taxesService = makeTaxesService();
            const annualIncome = monthlyIncome * 12;
            const monthlyAfterTax = await taxesService.calculateMonthlyAfterTaxIncome(
              settings.country,
              annualIncome,
              settings.stateOrProvince
            );
            monthlyIncome = monthlyAfterTax;
          }
        }
      }
    } catch (error) {
      // Continue with gross income if tax calculation fails
    }
  }

  const monthlyExpenses = transactions
    .filter((t) => {
      const isTransfer = t.type === "transfer" || !!(t as any).transferFromId || !!(t as any).transferToId;
      return t.type === "expense" && !isTransfer;
    })
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount);
    }, 0);

  const netAmount = monthlyIncome - monthlyExpenses;

  // Calculate savings rate
  const savingsRate = monthlyIncome > 0 
    ? (netAmount / monthlyIncome) * 100 
    : monthlyExpenses > 0 
    ? -100
    : 0;

  // Calculate expense ratio
  let expenseRatio: number;
  if (monthlyIncome > 0) {
    expenseRatio = (monthlyExpenses / monthlyIncome) * 100;
  } else if (monthlyExpenses > 0) {
    expenseRatio = 100;
  } else {
    expenseRatio = 0;
  }

  // Calculate score based on expense ratio
  let score: number;
  if (isNaN(expenseRatio) || !isFinite(expenseRatio)) {
    score = 0;
  } else if (expenseRatio <= 60) {
    score = Math.max(91, 100 - (expenseRatio / 60) * 9);
  } else if (expenseRatio <= 70) {
    score = Math.max(81, 90 - ((expenseRatio - 60) / 10) * 9);
  } else if (expenseRatio <= 80) {
    score = Math.max(71, 80 - ((expenseRatio - 70) / 10) * 9);
  } else if (expenseRatio <= 90) {
    score = Math.max(61, 70 - ((expenseRatio - 80) / 10) * 9);
  } else {
    const cappedRatio = Math.min(expenseRatio, 200);
    score = Math.max(0, 60 - ((cappedRatio - 90) / 10) * 60);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine classification
  let classification: "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
  if (expenseRatio <= 60) classification = "Excellent";
  else if (expenseRatio <= 70) classification = "Good";
  else if (expenseRatio <= 80) classification = "Fair";
  else if (expenseRatio <= 90) classification = "Poor";
  else classification = "Critical";

  // Generate message
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

  // Calculate spending discipline
  let spendingDiscipline: "Excellent" | "Good" | "Fair" | "Poor" | "Critical" | "Unknown";
  if (isNaN(savingsRate) || !isFinite(savingsRate)) {
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

  // Identify alerts and suggestions
  const alerts = identifyAlerts({
    monthlyIncome,
    monthlyExpenses,
    netAmount,
    savingsRate,
  });

  const suggestions = generateSuggestions({
    monthlyIncome,
    monthlyExpenses,
    netAmount,
    savingsRate,
    score,
    classification,
  });

  // Recalculate emergency fund months using the system Goal "Emergency Funds"
  // Priority: Use emergency fund goal if it exists
  // Otherwise, fall back to total balance calculation
  let emergencyFundMonths = 0;
  let emergencyFundGoal: any = null;
  const RECOMMENDED_MONTHS = 6; // Minimum recommended emergency fund months
  
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Get active household ID
      const { getActiveHouseholdId } = await import("@/lib/utils/household");
      const householdId = await getActiveHouseholdId(user.id, accessToken, refreshToken);
      
      if (householdId) {
        // Try to get emergency fund goal from system
        // Always use the system Goal "Emergency Funds" if it exists
        const { data: goal } = await supabase
          .from("Goal")
          .select("*")
          .eq("householdId", householdId)
          .eq("name", "Emergency Funds")
          .eq("isSystemGoal", true)
          .maybeSingle();
        
        emergencyFundGoal = goal;
        
        // If emergency fund goal exists, use its currentBalance
        // This is the preferred method - always use the Goal value
        if (emergencyFundGoal) {
          const goalBalance = emergencyFundGoal.currentBalance || 0;
          if (monthlyExpenses > 0) {
            emergencyFundMonths = goalBalance / monthlyExpenses;
          }
        } else {
          // Fallback to total balance calculation if goal doesn't exist
          let accountsToUse = accounts;
          
          if (!accountsToUse || accountsToUse.length === 0) {
            // CRITICAL: Use cached getAccountsForDashboard to avoid duplicate calls
            const { getAccountsForDashboard } = await import("../accounts/get-dashboard-accounts");
            accountsToUse = await getAccountsForDashboard(true);
          }
          
          const totalBalance = accountsToUse?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ?? 0;
          
          if (monthlyExpenses > 0) {
            emergencyFundMonths = totalBalance / monthlyExpenses;
          }
        }
      } else {
        // No household, use total balance calculation
        let accountsToUse = accounts;
        
        if (!accountsToUse || accountsToUse.length === 0) {
          // CRITICAL: Use cached getAccountsForDashboard to avoid duplicate calls
          accountsToUse = await getAccountsForDashboard(true);
        }
        
        const totalBalance = accountsToUse?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ?? 0;
        
        if (monthlyExpenses > 0) {
          emergencyFundMonths = totalBalance / monthlyExpenses;
        }
      }
    } else {
      // No user, use total balance calculation
      let accountsToUse = accounts;
      
      if (!accountsToUse || accountsToUse.length === 0) {
        // CRITICAL: Use cached getAccountsForDashboard to avoid duplicate calls
        accountsToUse = await getAccountsForDashboard(true);
      }
      
      const totalBalance = accountsToUse?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ?? 0;
      
      if (monthlyExpenses > 0) {
        emergencyFundMonths = totalBalance / monthlyExpenses;
      }
    }
  } catch (error) {
    console.warn("⚠️ [recalculateFinancialHealthFromTransactions] Could not calculate emergency fund months:", error);
    // Fall back to original value if calculation fails
    emergencyFundMonths = originalFinancialHealth.emergencyFundMonths;
  }

  // Adjust score based on Emergency Fund status (same logic as main calculation)
  let emergencyFundAdjustment = 0;
  
  if (!emergencyFundGoal) {
    // No Emergency Fund Goal exists: penalize score by 10 points
    emergencyFundAdjustment = -10;
  } else {
    // Emergency Fund Goal exists - check if it meets recommendations
    const targetAmount = emergencyFundGoal.targetAmount || 0;
    const currentBalance = emergencyFundGoal.currentBalance || 0;
    
    // Check if current balance meets recommended minimum (6 months)
    if (emergencyFundMonths >= RECOMMENDED_MONTHS) {
      // Meets or exceeds recommended minimum: bonus points
      if (emergencyFundMonths >= 12) {
        // Excellent: 12+ months - bonus of 10 points
        emergencyFundAdjustment = 10;
      } else {
        // Good: 6-12 months - bonus of 5 points
        emergencyFundAdjustment = 5;
      }
    } else {
      // Below recommended minimum: penalize based on how far below
      const monthsBelow = RECOMMENDED_MONTHS - emergencyFundMonths;
      const penaltyPercentage = Math.min(monthsBelow / RECOMMENDED_MONTHS, 1);
      emergencyFundAdjustment = Math.round(-9 * penaltyPercentage) - 1; // -1 to -10 points
    }
    
    // Additional check: if target is set but not reached, apply small additional penalty
    if (targetAmount > 0 && currentBalance < targetAmount) {
      const progressToTarget = currentBalance / targetAmount;
      if (progressToTarget < 0.5) {
        // Less than 50% of target: additional -2 points
        emergencyFundAdjustment -= 2;
      }
    }
  }
  
  // Apply emergency fund adjustment to score
  score = Math.max(0, Math.min(100, score + emergencyFundAdjustment));
  
  // Recalculate classification if score changed
  if (score >= 91) {
    classification = "Excellent";
  } else if (score >= 81) {
    classification = "Good";
  } else if (score >= 71) {
    classification = "Fair";
  } else if (score >= 61) {
    classification = "Poor";
  } else {
    classification = "Critical";
  }

  // Return updated financial health with recalculated metrics
  // Preserve debt exposure from original, but recalculate emergency fund months and adjust score
  return {
    ...originalFinancialHealth,
    score,
    classification,
    monthlyIncome,
    monthlyExpenses,
    netAmount,
    savingsRate,
    message,
    spendingDiscipline,
    emergencyFundMonths,
    alerts,
    suggestions,
  };
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
