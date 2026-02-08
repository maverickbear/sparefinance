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
import type { AccountWithBalance } from "../../domain/accounts/accounts.types";
import type { BaseGoal, GoalWithCalculations } from "../../domain/goals/goals.types";
import type { TransactionWithRelations } from "../../domain/transactions/transactions.types";
import type { DebtWithCalculations } from "../../domain/debts/debts.types";
import {
  penaltyCashFlow,
  penaltyEmergencyFund,
  penaltyDebtFromMDLR,
  penaltySavings,
  penaltyStability,
  getClassificationFromScore,
  getMessageFromClassification,
  computeEffectiveMonthlyDebtPayment,
} from "./spare-score-calculator";
import type { SpareScoreClassification } from "./spare-score-calculator";

export type { SpareScoreClassification } from "./spare-score-calculator";

export interface FinancialHealthData {
  score: number;
  classification: SpareScoreClassification;
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
  incomeIsAfterTax?: boolean; // True when monthlyIncome was converted to after-tax using household location
  isEmptyState?: boolean; // True when there are no transactions for the month (score/metrics are placeholders, not real values)
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
  accounts?: AccountWithBalance[] | null, // OPTIMIZED: Accept accounts to avoid duplicate getAccounts() call
  projectedIncome?: number, // Optional projected income for initial score calculation
  budgetRule?: BudgetRuleProfile, // Optional budget rule for validation
  preFetchedTransactions?: TransactionWithRelations[] | null,
  preFetchedPreviousTransactions?: TransactionWithRelations[] | null,
  preFetchedDebts?: DebtWithCalculations[] | null,
  preFetchedGoals?: GoalWithCalculations[] | null
): Promise<FinancialHealthData> {
  const date = selectedDate || new Date();
  const selectedMonth = startOfMonth(date);
  const selectedMonthEnd = endOfMonth(date);
  
  // Get transactions for selected month only (to match the cards at the top)
  // Call internal function directly to avoid reading cookies inside cached function
  const log = logger.withPrefix("calculateFinancialHealthInternal");

  let transactions: TransactionWithRelations[] = [];
  if (preFetchedTransactions) {
    transactions = preFetchedTransactions;
  } else {
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
    transactions = Array.isArray(transactionsResult)
      ? transactionsResult
      : (transactionsResult?.transactions || []);
  }
  
  // Only count income and expense transactions (exclude transfers)
  let monthlyIncome = transactions
    .filter((t) => {
      // Exclude transfers (transactions with type 'transfer' or with transferFromId/transferToId)
      const isTransfer = t.type === "transfer" || !!t.transferFromId || !!t.transferToId;
      return t.type === "income" && !isTransfer;
    })
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount); // Ensure income is positive
    }, 0);

  // Adjust income to after-tax if location is available
  let incomeIsAfterTax = false;
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
            incomeIsAfterTax = true;
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
      const isTransfer = t.type === "transfer" || !!t.transferFromId || !!t.transferToId;
      return t.type === "expense" && !isTransfer;
    })
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount); // Ensure expenses are positive
    }, 0);
  
  const netAmount = monthlyIncome - monthlyExpenses;
  
  // Handle case when there are no transactions
  if (transactions.length === 0 || (monthlyIncome === 0 && monthlyExpenses === 0)) {
    // If we have projected income, calculate projected score (penalty-based)
    if (projectedIncome && projectedIncome > 0) {
      const projectedExpenses = projectedIncome * 0.8; // 80% of income
      const projectedNet = projectedIncome - projectedExpenses;
      const projectedSavingsRate = (projectedNet / projectedIncome) * 100;

      const pCF = penaltyCashFlow(projectedIncome, projectedExpenses, projectedNet);
      const pEF = penaltyEmergencyFund(0); // no emergency fund yet
      const pDebt = 0; // no debt in projection
      const pSav = penaltySavings(projectedSavingsRate);
      const pStab = penaltyStability();
      const rawScore = 100 + pCF + pEF + pDebt + pSav + pStab;
      const score = Math.max(0, Math.min(100, Math.round(rawScore)));
      const classification: SpareScoreClassification = getClassificationFromScore(score);

      let spendingDiscipline: "Excellent" | "Good" | "Fair" | "Poor" | "Critical" | "Unknown";
      if (projectedSavingsRate >= 30) spendingDiscipline = "Excellent";
      else if (projectedSavingsRate >= 20) spendingDiscipline = "Good";
      else if (projectedSavingsRate >= 10) spendingDiscipline = "Fair";
      else if (projectedSavingsRate >= 0) spendingDiscipline = "Poor";
      else spendingDiscipline = "Critical";

      return {
        score,
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

    // No projected income: empty state — do NOT penalize (per doc: absence of data does not generate penalties)
    return {
      score: 100,
      classification: "Excellent" as const,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      netAmount: 0,
      savingsRate: 0,
      message: "Add income and expense transactions to calculate your Spare Score.",
      spendingDiscipline: "Unknown" as const,
      debtExposure: "Low" as const,
      emergencyFundMonths: 0,
      isEmptyState: true,
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

  // Debt: effective monthly payment and MDLR (before penalty-based score)
  let debtExposure: "Low" | "Moderate" | "High" = "Low";
  let penaltyDebt = 0;
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (userId && monthlyIncome > 0) {
      let debts: DebtWithCalculations[] = [];
      if (preFetchedDebts) {
        debts = preFetchedDebts;
      } else {
        const debtsService = makeDebtsService();
        debts = await debtsService.getDebts(accessToken, refreshToken);
      }

      const effectiveMonthlyPayment = computeEffectiveMonthlyDebtPayment(debts);
      const mdlrPct = (effectiveMonthlyPayment / monthlyIncome) * 100;
      penaltyDebt = penaltyDebtFromMDLR(mdlrPct);

      if (mdlrPct > 36) {
        debtExposure = "High";
      } else if (mdlrPct >= 20) {
        debtExposure = "Moderate";
      } else {
        debtExposure = "Low";
      }
    }
  } catch (error) {
    console.warn("⚠️ [calculateFinancialHealthInternal] Could not calculate debt exposure:", error);
  }

  // Emergency fund months (before penalty-based score)
  let emergencyFundMonths = 0;
  let emergencyFundGoal: BaseGoal | null = null;
  let accountsToUse = accounts && accounts.length > 0 ? accounts : null;
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { getActiveHouseholdId } = await import("@/lib/utils/household");
      const householdId = await getActiveHouseholdId(user.id, accessToken, refreshToken);

      if (householdId) {
        if (preFetchedGoals) {
          const goal = preFetchedGoals.find(g =>
            g.householdId === householdId &&
            g.name === "Emergency Funds" &&
            g.isSystemGoal
          );
          if (goal) emergencyFundGoal = goal;
        } else {
          const { data: goal } = await supabase
            .from("goals")
            .select("*")
            .eq("household_id", householdId)
            .eq("name", "Emergency Funds")
            .eq("is_system_goal", true)
            .maybeSingle();
          emergencyFundGoal = goal;
        }

        if (emergencyFundGoal) {
          const goalBalance = emergencyFundGoal.currentBalance || 0;
          if (monthlyExpenses > 0) emergencyFundMonths = goalBalance / monthlyExpenses;
        } else {
          if (!accountsToUse) {
            const { getAccountsForDashboard } = await import("../accounts/get-dashboard-accounts");
            accountsToUse = await getAccountsForDashboard(true);
          }
          const totalBalance = accountsToUse?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ?? 0;
          if (monthlyExpenses > 0) emergencyFundMonths = totalBalance / monthlyExpenses;
        }
      } else {
        if (!accountsToUse) {
          const { getAccountsForDashboard } = await import("../accounts/get-dashboard-accounts");
          accountsToUse = await getAccountsForDashboard(true);
        }
        const totalBalance = accountsToUse?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ?? 0;
        if (monthlyExpenses > 0) emergencyFundMonths = totalBalance / monthlyExpenses;
      }
    } else {
      if (!accountsToUse) {
        const { getAccountsForDashboard } = await import("../accounts/get-dashboard-accounts");
        accountsToUse = await getAccountsForDashboard(true);
      }
      const totalBalance = accountsToUse?.reduce((sum, acc) => sum + (acc.balance || 0), 0) ?? 0;
      if (monthlyExpenses > 0) emergencyFundMonths = totalBalance / monthlyExpenses;
    }
  } catch (error) {
    console.warn("⚠️ [calculateFinancialHealthInternal] Could not calculate emergency fund months:", error);
    if (accountsToUse && monthlyExpenses > 0) {
      const totalBalance = accountsToUse.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      emergencyFundMonths = totalBalance / monthlyExpenses;
    }
  }

  // Penalty-based score (Spare Score = 100 - sum(penalties), docs/Spare_Score.md)
  const penaltyCF = penaltyCashFlow(monthlyIncome, monthlyExpenses, netAmount);
  const penaltyEF = penaltyEmergencyFund(emergencyFundMonths);
  const penaltySav = penaltySavings(savingsRate);
  const penaltyStab = penaltyStability();
  let rawScore = 100 + penaltyCF + penaltyEF + penaltyDebt + penaltySav + penaltyStab;

  // Last month score (same penalty formula) for trend and smoothing
  let lastMonthScore: number | undefined;
  try {
    const lastMonth = subMonths(selectedMonth, 1);
    let lastMonthTransactions: TransactionWithRelations[] = [];
    if (preFetchedPreviousTransactions) {
      lastMonthTransactions = preFetchedPreviousTransactions;
    } else {
      const transactionsService = makeTransactionsService();
      const lastMonthEnd = endOfMonth(lastMonth);
      const lastMonthResult = await transactionsService.getTransactions(
        { startDate: lastMonth, endDate: lastMonthEnd },
        accessToken,
        refreshToken
      );
      lastMonthTransactions = Array.isArray(lastMonthResult)
        ? lastMonthResult
        : (lastMonthResult?.transactions || []);
    }

    const lastMonthIncome = lastMonthTransactions
      .filter((t) => {
        const isTransfer = t.type === "transfer" || !!(t as any).transferFromId || !!(t as any).transferToId;
        return t.type === "income" && !isTransfer;
      })
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const lastMonthExpenses = lastMonthTransactions
      .filter((t) => {
        const isTransfer = t.type === "transfer" || !!(t as any).transferFromId || !!(t as any).transferToId;
        return t.type === "expense" && !isTransfer;
      })
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const lastMonthNet = lastMonthIncome - lastMonthExpenses;
    const lastMonthSavingsRate = lastMonthIncome > 0
      ? (lastMonthNet / lastMonthIncome) * 100
      : lastMonthExpenses > 0 ? -100 : 0;

    const lmPenaltyCF = penaltyCashFlow(lastMonthIncome, lastMonthExpenses, lastMonthNet);
    const lmPenaltySav = penaltySavings(lastMonthSavingsRate);
    const lastMonthRawScore = 100 + lmPenaltyCF + penaltyEF + penaltyDebt + lmPenaltySav + penaltyStab;
    lastMonthScore = Math.max(0, Math.min(100, Math.round(lastMonthRawScore)));
  } catch (error) {
    console.warn("⚠️ [calculateFinancialHealthInternal] Could not calculate last month score:", error);
  }

  // Smoothing: max monthly drop 15 points
  if (lastMonthScore !== undefined && rawScore < lastMonthScore) {
    rawScore = Math.max(rawScore, lastMonthScore - 15);
  }
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const classification: SpareScoreClassification = getClassificationFromScore(score);
  const message = getMessageFromClassification(classification);

  // Identify alerts
  let alerts = identifyAlerts({
    monthlyIncome,
    monthlyExpenses,
    netAmount,
    savingsRate,
    emergencyFundMonths,
    debtExposure,
  });
  
  // Validate against budget rule if provided
  if (budgetRule && monthlyIncome > 0 && transactions.length > 0) {
    try {
      const budgetRulesService = makeBudgetRulesService();
      const budgetsService = makeBudgetsService();
      const categoriesService = makeCategoriesService();
      
      // Get budgets for the period
      const budgets = await budgetsService.getBudgets(selectedMonth, accessToken, refreshToken);
      
      // Get categories to map to rule categories
      const allCategories = await categoriesService.getAllCategories();
      const categoryMappings = budgetRulesService.mapCategoriesToRuleCategories(allCategories);
      
      // Validate budgets against rule
      const validation = budgetRulesService.validateBudgetAgainstRule(
        budgets,
        transactions,
        budgetRule,
        monthlyIncome,
        categoryMappings
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
    emergencyFundMonths,
    debtExposure,
  });

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
    incomeIsAfterTax,
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
  accounts?: AccountWithBalance[] | null, // OPTIMIZED: Accept accounts to avoid duplicate getAccounts() call
  projectedIncome?: number, // Optional projected income for initial score calculation
  budgetRule?: BudgetRuleProfile, // Optional budget rule for validation
  preFetchedTransactions?: TransactionWithRelations[] | null,
  preFetchedPreviousTransactions?: TransactionWithRelations[] | null,
  preFetchedDebts?: DebtWithCalculations[] | null,
  preFetchedGoals?: GoalWithCalculations[] | null
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
    const result = await calculateFinancialHealthInternal(
      selectedDate, 
      finalAccessToken, 
      finalRefreshToken, 
      accounts, 
      projectedIncome, 
      budgetRule,
      preFetchedTransactions,
      preFetchedPreviousTransactions,
      preFetchedDebts,
      preFetchedGoals
    );
    
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
  transactions: TransactionWithRelations[],
  originalFinancialHealth: FinancialHealthData | null,
  accessToken?: string,
  refreshToken?: string,
  accounts?: AccountWithBalance[]
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

  // Penalty-based score (preserve debt/emergency from original)
  const penaltyCF = penaltyCashFlow(monthlyIncome, monthlyExpenses, netAmount);
  const penaltyEF = penaltyEmergencyFund(originalFinancialHealth.emergencyFundMonths);
  const penaltyDebtFromExposure =
    originalFinancialHealth.debtExposure === "High" ? -20
    : originalFinancialHealth.debtExposure === "Moderate" ? -8
    : 0;
  const penaltySav = penaltySavings(savingsRate);
  const penaltyStab = penaltyStability();
  const rawScore = 100 + penaltyCF + penaltyEF + penaltyDebtFromExposure + penaltySav + penaltyStab;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const classification: SpareScoreClassification = getClassificationFromScore(score);
  const message = getMessageFromClassification(classification);

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
    emergencyFundMonths: originalFinancialHealth.emergencyFundMonths,
    debtExposure: originalFinancialHealth.debtExposure,
  });

  const suggestions = generateSuggestions({
    monthlyIncome,
    monthlyExpenses,
    netAmount,
    savingsRate,
    score,
    classification,
    emergencyFundMonths: originalFinancialHealth.emergencyFundMonths,
    debtExposure: originalFinancialHealth.debtExposure,
  });

  // Recalculate emergency fund months using the system Goal "Emergency Funds"
  let emergencyFundMonths = 0;
  let emergencyFundGoal: BaseGoal | null = null;
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
          .from("goals")
          .select("*")
          .eq("household_id", householdId)
          .eq("name", "Emergency Funds")
          .eq("is_system_goal", true)
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
    emergencyFundMonths = originalFinancialHealth.emergencyFundMonths;
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
  emergencyFundMonths?: number;
  debtExposure?: "Low" | "Moderate" | "High";
}): Array<{
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  action: string;
}> {
  const alerts = [];

  // Cash flow: expenses exceeding income
  if (data.monthlyIncome > 0 && data.monthlyExpenses > data.monthlyIncome) {
    const excessPercentage = ((data.monthlyExpenses / data.monthlyIncome - 1) * 100).toFixed(1);
    alerts.push({
      id: "expenses_exceeding_income",
      title: "Negative Cash Flow",
      description: `Your monthly expenses (${formatMoney(data.monthlyExpenses)}) are ${excessPercentage}% higher than your income (${formatMoney(data.monthlyIncome)}).`,
      severity: "critical" as const,
      action: "Review your expenses and identify where you can reduce costs.",
    });
  } else if (data.monthlyIncome === 0 && data.monthlyExpenses > 0) {
    alerts.push({
      id: "expenses_exceeding_income",
      title: "Negative Cash Flow",
      description: `You have monthly expenses (${formatMoney(data.monthlyExpenses)}) but no income recorded for this month.`,
      severity: "critical" as const,
      action: "Add income transactions or review your expenses.",
    });
  }

  // Savings: negative or low rate
  if (data.savingsRate < 0) {
    alerts.push({
      id: "negative_savings_rate",
      title: "Negative Savings Rate",
      description: `You are spending ${formatMoney(Math.abs(data.netAmount))} more than you earn per month.`,
      severity: "critical" as const,
      action: "Create a strict budget and increase your income or reduce expenses.",
    });
  }
  if (data.savingsRate > 0 && data.savingsRate < 10) {
    alerts.push({
      id: "low_savings_rate",
      title: "Low Savings Rate",
      description: `You are saving only ${data.savingsRate.toFixed(1)}% of your income. Aim for at least 20%.`,
      severity: "warning" as const,
      action: "Try to increase your savings rate to at least 20%.",
    });
  }
  if (data.savingsRate > 0 && data.savingsRate < 5) {
    alerts.push({
      id: "very_low_savings_rate",
      title: "Very Low Savings Rate",
      description: `Your savings rate of ${data.savingsRate.toFixed(1)}% is below recommended.`,
      severity: "info" as const,
      action: "Consider reviewing your expenses to increase your savings capacity.",
    });
  }

  // Emergency fund (pillar 2)
  if (data.emergencyFundMonths !== undefined && data.emergencyFundMonths < 6) {
    alerts.push({
      id: "emergency_fund_low",
      title: "Low Emergency Fund",
      description: `You have ${data.emergencyFundMonths.toFixed(1)} months of expenses covered. Recommended: 6 months.`,
      severity: (data.emergencyFundMonths < 1 ? "critical" : data.emergencyFundMonths < 2 ? "warning" : "info") as "critical" | "warning" | "info",
      action: "Build your emergency fund to cover at least 6 months of essential expenses.",
    });
  }

  // Debt load (pillar 3)
  if (data.debtExposure === "High") {
    alerts.push({
      id: "debt_load_high",
      title: "High Debt Load",
      description: "Your monthly debt payments are a high share of your income.",
      severity: "warning" as const,
      action: "Review your debts and consider reducing the load below 30% of income.",
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
  emergencyFundMonths?: number;
  debtExposure?: "Low" | "Moderate" | "High";
}): Array<{
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
}> {
  const suggestions = [];

  // Cash flow: recovery +8 to +12 for positive cash flow next month (doc)
  if (data.monthlyExpenses > data.monthlyIncome) {
    const reductionNeeded = data.monthlyExpenses - data.monthlyIncome;
    suggestions.push({
      id: "reduce_expenses",
      title: "Reach Positive Cash Flow",
      description: `Reduce expenses by ${formatMoney(reductionNeeded)}/month to balance income and expenses. This can recover about 8–12 points on your Spare Score.`,
      impact: "high" as const,
    });
  }
  if (data.savingsRate < 0) {
    suggestions.push({
      id: "increase_income_or_reduce_expenses",
      title: "Increase Income or Reduce Expenses",
      description: "Prioritize increasing income or reducing expenses. Positive cash flow next month can recover 8–12 points.",
      impact: "high" as const,
    });
  }

  // Savings: 20% target
  if (data.savingsRate >= 0 && data.savingsRate < 10) {
    const targetSavings = data.monthlyIncome * 0.2;
    suggestions.push({
      id: "increase_savings_rate",
      title: "Aim for 20% Savings Rate",
      description: `Save at least 20% of income (${formatMoney(targetSavings)}/month) to avoid penalties on the Savings Behavior pillar.`,
      impact: "high" as const,
    });
  }
  if (data.savingsRate >= 10 && data.savingsRate < 20) {
    suggestions.push({
      id: "review_spending",
      title: "Review Expenses",
      description: "Analyze expense categories and find ways to reduce without affecting quality of life.",
      impact: "medium" as const,
    });
  }

  // Emergency fund: build 1-month can recover +6 (doc)
  if (data.emergencyFundMonths !== undefined && data.emergencyFundMonths < 6) {
    suggestions.push({
      id: "build_emergency_fund",
      title: "Build Emergency Fund",
      description: data.emergencyFundMonths < 1
        ? "Building even 1 month of essential expenses can recover about 6 points."
        : "Reaching 6 months of expenses covered removes emergency fund penalties.",
      impact: data.emergencyFundMonths < 2 ? "high" as const : "medium" as const,
    });
  }

  // Debt: reduce load below 20% +6, remove high-interest +8 (doc)
  if (data.debtExposure === "High" || data.debtExposure === "Moderate") {
    suggestions.push({
      id: "reduce_debt_load",
      title: "Reduce Debt Load",
      description: "Reducing monthly debt payments below 20% of income can recover about 6 points. Paying off high-interest debt can recover about 8.",
      impact: data.debtExposure === "High" ? "high" as const : "medium" as const,
    });
  }

  if (data.monthlyExpenses > data.monthlyIncome * 0.9) {
    suggestions.push({
      id: "create_budget",
      title: "Create Budget",
      description: "Create a detailed budget to control expenses and save regularly.",
      impact: "medium" as const,
    });
  }
  if (data.savingsRate >= 20 && data.savingsRate < 30) {
    suggestions.push({
      id: "optimize_savings",
      title: "Optimize Savings",
      description: "You're on the right track. Consider automating savings.",
      impact: "low" as const,
    });
  }
  if (data.savingsRate >= 30) {
    suggestions.push({
      id: "maintain_good_habits",
      title: "Maintain Good Practices",
      description: "You're maintaining a healthy savings rate. Keep it up!",
      impact: "low" as const,
    });
  }

  return suggestions;
}
