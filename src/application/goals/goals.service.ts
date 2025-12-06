/**
 * Goals Service
 * Business logic for goal management
 */

import { GoalsRepository } from "@/src/infrastructure/database/repositories/goals.repository";
import { GoalsMapper } from "./goals.mapper";
import { GoalFormData } from "../../domain/goals/goals.validations";
import { BaseGoal, GoalWithCalculations } from "../../domain/goals/goals.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp, formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { requireGoalOwnership } from "@/lib/utils/security";
import { logger } from "@/lib/utils/logger";
import { calculateProgress } from "@/lib/utils/goals";
import { startOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { getTransactionAmount } from "@/lib/utils/transaction-encryption";
import { AppError } from "../shared/app-error";
import { GoalPlannedPaymentsService } from "../planned-payments/goal-planned-payments.service";
// CRITICAL: Use static import to ensure React cache() works correctly
import { getAccountsForDashboard } from "../accounts/get-dashboard-accounts";

export class GoalsService {
  private goalPlannedPaymentsService: GoalPlannedPaymentsService;

  constructor(private repository: GoalsRepository) {
    this.goalPlannedPaymentsService = new GoalPlannedPaymentsService();
  }

  /**
   * Calculate income basis from last 3 months of income transactions
   * 
   * This method calculates the average monthly income from the last 3 complete months
   * (excluding the current month if it's not complete). The calculation includes:
   * - 3 months before the current month
   * - The current month (if it has transactions)
   * 
   * The result is the average of all months with transactions, providing a more
   * accurate income basis for goal calculations.
   * 
   * @param expectedIncome - Optional expected income value to use instead of calculating from transactions
   * @param accessToken - Optional Supabase access token for authenticated requests
   * @param refreshToken - Optional Supabase refresh token for authenticated requests
   * @returns Average monthly income from the analyzed period
   */
  async calculateIncomeBasis(
    expectedIncome?: number | null,
    accessToken?: string,
    refreshToken?: string
  ): Promise<number> {
    if (expectedIncome && expectedIncome > 0) {
      logger.log("[GoalsService] Using provided expectedIncome:", expectedIncome);
      return expectedIncome;
    }

    const supabase = await createServerClient(accessToken, refreshToken);
    const now = new Date();
    const currentMonth = startOfMonth(now);
    
    // Get last 3 months plus current month
    // Note: eachMonthOfInterval includes both start and end, so this gives us 4 months total
    // (3 months before + current month). We calculate the average of all months with transactions.
    const months = eachMonthOfInterval({
      start: subMonths(currentMonth, 3),
      end: currentMonth,
    });

    logger.log(
      `[GoalsService] Calculating income basis: analyzing ${months.length} months ` +
      `(from ${months[0]?.toISOString().substring(0, 7)} to ${months[months.length - 1]?.toISOString().substring(0, 7)}) ` +
      `and averaging monthly income`
    );

    const { decryptTransactionsBatch } = await import("@/lib/utils/transaction-encryption");

    const monthlyIncomes = await Promise.all(
      months.map(async (month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

        const { data: transactions } = await supabase
          .from("Transaction")
          .select("amount")
          .eq("type", "income")
          .gte("date", formatDateStart(monthStart))
          .lte("date", formatDateEnd(monthEnd));

        if (!transactions) return 0;

        const decryptedTransactions = decryptTransactionsBatch(transactions);
        const monthIncome = decryptedTransactions.reduce((sum: number, tx: any) => {
          const amount = getTransactionAmount(tx.amount) || 0;
          return sum + amount;
        }, 0);
        
        logger.debug(
          `[GoalsService] Month ${monthStart.toISOString().substring(0, 7)}: ` +
          `${transactions.length} transaction(s), total income: ${monthIncome}`
        );
        
        return monthIncome;
      })
    );

    // Calculate average of all months with transactions
    const totalIncome = monthlyIncomes.reduce((sum, income) => sum + income, 0);
    const monthsWithData = monthlyIncomes.filter(income => income > 0).length;
    const averageIncome = monthlyIncomes.length > 0 ? totalIncome / monthlyIncomes.length : 0;

    logger.log(
      `[GoalsService] Income basis calculation complete: ` +
      `Total income across ${months.length} months: ${totalIncome}, ` +
      `Months with data: ${monthsWithData}, ` +
      `Average monthly income: ${averageIncome}`
    );

    return averageIncome;
  }

  /**
   * Validate that total allocation doesn't exceed 100%
   */
  async validateAllocation(
    excludeGoalId: string | null,
    newIncomePercentage: number
  ): Promise<{ valid: boolean; message?: string }> {
    const goals = await this.repository.findAll();
    
    // Filter out the goal being updated/created
    const otherGoals = excludeGoalId 
      ? goals.filter(g => g.id !== excludeGoalId)
      : goals;

    // Sum up all income percentages (excluding paused goals)
    const totalAllocation = otherGoals
      .filter(g => !g.isPaused)
      .reduce((sum, goal) => sum + goal.incomePercentage, 0);

    const newTotal = totalAllocation + newIncomePercentage;

    if (newTotal > 100) {
      return {
        valid: false,
        message: `Total allocation would be ${newTotal.toFixed(1)}%. Maximum is 100%.`,
      };
    }

    return { valid: true };
  }

  /**
   * Get all goals with calculations
   * @param accessToken - Optional access token
   * @param refreshToken - Optional refresh token
   * @param accounts - Optional accounts array to avoid duplicate getAccounts() call
   */
  async getGoals(
    accessToken?: string,
    refreshToken?: string,
    accounts?: any[] // OPTIMIZED: Accept accounts to avoid duplicate getAccounts() call
  ): Promise<GoalWithCalculations[]> {
    const rows = await this.repository.findAll(accessToken, refreshToken);

    // OPTIMIZATION: Ensure emergency fund goal exists even if no other goals
    // This ensures users always have at least the emergency fund goal
    const hasEmergencyFund = rows.some(g => g.isSystemGoal && g.name?.toLowerCase().includes('emergency'));
    
    if (!hasEmergencyFund) {
      // Try to create emergency fund goal
      // First try calculateAndUpdateEmergencyFund (which calculates values)
      // If that fails, try to create a basic emergency fund goal
      try {
        const createdGoal = await this.calculateAndUpdateEmergencyFund(accessToken, refreshToken);
        if (createdGoal) {
          // Re-fetch goals after creating emergency fund
          const updatedRows = await this.repository.findAll(accessToken, refreshToken);
          if (updatedRows.length > rows.length) {
            // Emergency fund was created, use updated rows
            rows.length = 0;
            rows.push(...updatedRows);
          }
        }
      } catch (error) {
        // If calculateAndUpdateEmergencyFund fails, try to create basic emergency fund
        // This can happen if user doesn't have household or insufficient data
        logger.warn("[GoalsService] Could not calculate emergency fund, trying to create basic goal:", error);
        
        try {
          const supabase = await createServerClient(accessToken, refreshToken);
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            const householdId = await getActiveHouseholdId(user.id, accessToken, refreshToken);
            if (householdId) {
              // Create basic emergency fund goal
              const basicGoal = await this.createGoal({
                name: "Emergency Funds",
                targetAmount: 0,
                currentBalance: 0,
                incomePercentage: 0,
                priority: "High",
                targetMonths: 0,
                description: "Emergency fund for unexpected expenses",
                isPaused: false,
                isSystemGoal: true,
              });
              
              if (basicGoal) {
                // Re-fetch goals after creating emergency fund
                const updatedRows = await this.repository.findAll(accessToken, refreshToken);
                if (updatedRows.length > rows.length) {
                  rows.length = 0;
                  rows.push(...updatedRows);
                }
              }
            }
          }
        } catch (basicError) {
          logger.warn("[GoalsService] Could not create basic emergency fund goal:", basicError);
        }
      }
    }

    // Early return if still no goals after trying to create emergency fund
    if (rows.length === 0) {
      return [];
    }

    // OPTIMIZATION: Fetch income basis and accounts in parallel
    const goalsWithAccount = rows.filter(g => g.accountId);
    
    // OPTIMIZED: Use provided accounts if available, otherwise fetch only if needed
    const [incomeBasis, fetchedAccounts] = await Promise.all([
      // Calculate income basis
      this.calculateIncomeBasis(undefined, accessToken, refreshToken),
      // Get accounts only if not provided and needed
      (!accounts || accounts.length === 0) && goalsWithAccount.length > 0
        ? getAccountsForDashboard(false)
        : Promise.resolve([]),
    ]);
    
    // Use provided accounts or fetched accounts
    const accountsToUse = accounts && accounts.length > 0 ? accounts : fetchedAccounts;

    const accountsMap = new Map<string, any>();
    accountsToUse.forEach(acc => {
      accountsMap.set(acc.id, acc);
    });

    // OPTIMIZATION: Don't update database during getGoals - this is too slow
    // Balance syncing should be done in background jobs or separate endpoints
    // For now, just read the balance without updating
    const goalsWithCalculations: GoalWithCalculations[] = await Promise.all(
      rows.map(async (goal) => {
        let currentBalance = goal.currentBalance;

        // If goal has accountId, sync balance from account (read-only, no DB update)
        if (goal.accountId) {
          const account = accountsMap.get(goal.accountId);
          
          if (account) {
            // Use account balance for display, but don't update DB here (too slow)
            const accountBalance = account.balance || 0;
            currentBalance = accountBalance;
          }
        }

        // Check if goal is completed
        const isCompleted = currentBalance >= goal.targetAmount;
        
        // Use goal's expectedIncome if available, otherwise use calculated incomeBasis
        const goalIncomeBasis = goal.expectedIncome && goal.expectedIncome > 0
          ? goal.expectedIncome
          : incomeBasis;

        const progress = calculateProgress({ ...goal, currentBalance }, goalIncomeBasis);

        return GoalsMapper.toDomainWithCalculations(goal, {
          ...progress,
          incomeBasis: goalIncomeBasis,
        });
      })
    );

    return goalsWithCalculations;
  }

  /**
   * Get goal by ID
   */
  async getGoalById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<GoalWithCalculations | null> {
    const row = await this.repository.findById(id, accessToken, refreshToken);
    
    if (!row) {
      return null;
    }

    const incomeBasis = await this.calculateIncomeBasis(row.expectedIncome, accessToken, refreshToken);
    const progress = calculateProgress(row, incomeBasis);

    return GoalsMapper.toDomainWithCalculations(row, {
      ...progress,
      incomeBasis,
    });
  }

  /**
   * Create a new goal
   */
  async createGoal(data: GoalFormData): Promise<BaseGoal> {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new AppError("Unauthorized", 401);
    }

    // Validate targetAmount
    if (data.targetAmount <= 0 && !data.isSystemGoal) {
      throw new AppError("Target amount must be greater than 0", 400);
    }

    // Calculate incomePercentage if targetMonths is provided
    let incomePercentage = data.incomePercentage || 0;
    if (data.targetMonths && data.targetMonths > 0 && (!data.incomePercentage || data.incomePercentage === 0)) {
      const incomeBasis = await this.calculateIncomeBasis(data.expectedIncome);
      if (incomeBasis > 0) {
        const { calculateIncomePercentageFromTargetMonths } = await import("@/lib/utils/goals");
        incomePercentage = calculateIncomePercentageFromTargetMonths(
          data.targetAmount,
          data.currentBalance || 0,
          data.targetMonths,
          incomeBasis
        );
      }
    }

    // Validate allocation
    if (incomePercentage > 0) {
      const validation = await this.validateAllocation(null, incomePercentage);
      if (!validation.valid) {
        throw new AppError(validation.message || "Total allocation exceeds 100%", 400);
      }
    }

    // Check if goal is already completed
    const isCompleted = data.targetAmount > 0 && (data.currentBalance || 0) >= data.targetAmount;

    // Get active household ID
    const householdId = await getActiveHouseholdId(user.id);
    if (!householdId) {
      throw new AppError("No active household found. Please contact support.", 400);
    }

    const id = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    const goalRow = await this.repository.create({
      id,
      name: data.name,
      targetAmount: data.targetAmount,
      currentBalance: data.currentBalance || 0,
      incomePercentage,
      priority: data.priority,
      description: data.description || null,
      isPaused: false,
      isCompleted,
      completedAt: isCompleted ? now : null,
      expectedIncome: data.expectedIncome || null,
      targetMonths: data.targetMonths || null,
      accountId: data.accountId || null,
      holdingId: data.holdingId || null,
      isSystemGoal: data.isSystemGoal || false,
      userId: user.id,
      householdId,
      createdAt: now,
      updatedAt: now,
    });

    const goal = GoalsMapper.toDomain(goalRow);

    // Generate planned payments for the goal (async, don't wait)
    if (!goal.isCompleted && !goal.isPaused && goal.accountId && goal.incomePercentage > 0) {
      this.calculateIncomeBasis(goal.expectedIncome)
        .then(async (incomeBasis) => {
          if (incomeBasis > 0) {
            const goalWithCalculations = await this.getGoalById(goal.id);
            if (goalWithCalculations) {
              return this.goalPlannedPaymentsService.generatePlannedPaymentsForGoal(
                goalWithCalculations,
                incomeBasis
              );
            }
          }
        })
        .catch((error) => {
          logger.error(
            `[GoalsService] Error generating planned payments for goal ${goal.id}:`,
            error
          );
        });
    }

    return goal;
  }

  /**
   * Update a goal
   */
  async updateGoal(
    id: string,
    data: Partial<GoalFormData & { isPaused?: boolean }>
  ): Promise<BaseGoal> {
    // Verify ownership
    await requireGoalOwnership(id);

    // Get current goal
    const currentGoal = await this.repository.findById(id);
    if (!currentGoal) {
      throw new AppError("Goal not found", 404);
    }

    // Validate targetAmount
    const targetAmount = data.targetAmount ?? currentGoal.targetAmount;
    const isSystemGoal = currentGoal.isSystemGoal;
    if (data.targetAmount !== undefined && data.targetAmount <= 0 && !isSystemGoal) {
      throw new AppError("Target amount must be greater than 0", 400);
    }

    const effectiveCurrentBalance = data.currentBalance !== undefined 
      ? data.currentBalance 
      : currentGoal.currentBalance;

    // Calculate incomePercentage if targetMonths is provided
    let incomePercentage = data.incomePercentage;
    if (data.targetMonths && data.targetMonths > 0 && data.incomePercentage === undefined) {
      const expectedIncome = data.expectedIncome ?? currentGoal.expectedIncome;
      const incomeBasis = await this.calculateIncomeBasis(expectedIncome);
      if (incomeBasis > 0) {
        const { calculateIncomePercentageFromTargetMonths } = await import("@/lib/utils/goals");
        incomePercentage = calculateIncomePercentageFromTargetMonths(
          targetAmount,
          effectiveCurrentBalance,
          data.targetMonths,
          incomeBasis
        );
      }
    }

    // Validate allocation if incomePercentage is being updated
    if (incomePercentage !== undefined) {
      const validation = await this.validateAllocation(id, incomePercentage);
      if (!validation.valid) {
        throw new AppError(validation.message || "Total allocation exceeds 100%", 400);
      }
    }

    // Check if goal should be marked as completed
    const isCompleted = targetAmount > 0 && effectiveCurrentBalance >= targetAmount;

    const updateData: any = {
      updatedAt: formatTimestamp(new Date()),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.targetAmount !== undefined) updateData.targetAmount = data.targetAmount;
    if (data.currentBalance !== undefined) updateData.currentBalance = data.currentBalance;
    if (incomePercentage !== undefined) updateData.incomePercentage = incomePercentage;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.isPaused !== undefined) updateData.isPaused = data.isPaused;
    if (data.expectedIncome !== undefined) updateData.expectedIncome = data.expectedIncome || null;
    if (data.targetMonths !== undefined) updateData.targetMonths = data.targetMonths || null;
    if (data.accountId !== undefined) updateData.accountId = data.accountId || null;
    if (data.holdingId !== undefined) updateData.holdingId = data.holdingId || null;

    // Update completion status
    updateData.isCompleted = isCompleted;
    if (isCompleted && !currentGoal.completedAt) {
      updateData.completedAt = formatTimestamp(new Date());
    } else if (!isCompleted && currentGoal.completedAt) {
      updateData.completedAt = null;
    }

    const goalRow = await this.repository.update(id, updateData);

    const goal = GoalsMapper.toDomain(goalRow);

    // Sync planned payments for the goal (async, don't wait)
    if (goal.accountId && (goal.incomePercentage > 0 || data.incomePercentage !== undefined)) {
      this.calculateIncomeBasis(goal.expectedIncome)
        .then(async (incomeBasis) => {
          if (incomeBasis > 0) {
            const goalWithCalculations = await this.getGoalById(id);
            if (goalWithCalculations) {
              return this.goalPlannedPaymentsService.syncPlannedPaymentsForGoal(
                goalWithCalculations,
                incomeBasis
              );
            }
          }
        })
        .catch((error) => {
          logger.error(
            `[GoalsService] Error syncing planned payments for goal ${id}:`,
            error
          );
        });
    }

    return goal;
  }

  /**
   * Delete a goal
   */
  async deleteGoal(id: string): Promise<void> {
    // Verify ownership
    await requireGoalOwnership(id);

    await this.repository.delete(id);

  }

  /**
   * Add top-up to goal balance
   */
  async addTopUp(id: string, amount: number): Promise<BaseGoal> {
    // Verify ownership
    await requireGoalOwnership(id);

    const goal = await this.repository.findById(id);
    if (!goal) {
      throw new AppError("Goal not found", 404);
    }

    const newBalance = goal.currentBalance + amount;
    const isCompleted = newBalance >= goal.targetAmount;

    const goalRow = await this.repository.update(id, {
      currentBalance: newBalance,
      isCompleted,
      completedAt: isCompleted && !goal.completedAt ? formatTimestamp(new Date()) : goal.completedAt,
      updatedAt: formatTimestamp(new Date()),
    });


    return GoalsMapper.toDomain(goalRow);
  }

  /**
   * Withdraw from goal balance
   */
  async withdraw(id: string, amount: number): Promise<BaseGoal> {
    // Verify ownership
    await requireGoalOwnership(id);

    if (amount <= 0) {
      throw new AppError("Withdrawal amount must be positive", 400);
    }

    const goal = await this.repository.findById(id);
    if (!goal) {
      throw new AppError("Goal not found", 404);
    }

    const newBalance = Math.max(0, goal.currentBalance - amount);
    const isCompleted = newBalance >= goal.targetAmount;

    const goalRow = await this.repository.update(id, {
      currentBalance: newBalance,
      isCompleted,
      completedAt: isCompleted && !goal.completedAt ? formatTimestamp(new Date()) : (isCompleted ? goal.completedAt : null),
      updatedAt: formatTimestamp(new Date()),
    });


    return GoalsMapper.toDomain(goalRow);
  }

  /**
   * Calculate monthly expenses from last 3 months of expense transactions
   */
  async calculateMonthlyExpenses(
    accessToken?: string,
    refreshToken?: string
  ): Promise<number> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const now = new Date();
    const currentMonth = startOfMonth(now);
    
    // Get last 3 months
    const months = eachMonthOfInterval({
      start: subMonths(currentMonth, 3),
      end: currentMonth,
    });

    const { decryptTransactionsBatch } = await import("@/lib/utils/transaction-encryption");

    const monthlyExpenses = await Promise.all(
      months.map(async (month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

        const { data: transactions } = await supabase
          .from("Transaction")
          .select("amount")
          .eq("type", "expense")
          .gte("date", formatDateStart(monthStart))
          .lte("date", formatDateEnd(monthEnd));

        if (!transactions) return 0;

        const decryptedTransactions = decryptTransactionsBatch(transactions);
        const monthExpenses = decryptedTransactions.reduce((sum: number, tx: any) => {
          const amount = getTransactionAmount(tx.amount) || 0;
          return sum + Math.abs(amount); // Ensure expenses are positive
        }, 0);
        
        return monthExpenses;
      })
    );

    // Calculate average
    const totalExpenses = monthlyExpenses.reduce((sum, expenses) => sum + expenses, 0);
    return monthlyExpenses.length > 0 ? totalExpenses / monthlyExpenses.length : 0;
  }

  /**
   * Automatically calculate and update emergency fund goal based on income and expenses
   * Uses predicted income if available, otherwise calculates from transactions
   * Follows financial best practices: 6 months of expenses as target, 10-20% of income for savings
   */
  async calculateAndUpdateEmergencyFund(
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseGoal | null> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new AppError("Unauthorized", 401);
    }

    const householdId = await getActiveHouseholdId(user.id, accessToken, refreshToken);
    if (!householdId) {
      logger.warn("[GoalsService] No active household found for emergency fund calculation");
      return null;
    }

    // Get or create emergency fund goal
    let emergencyFundGoal = await this.repository.findEmergencyFundGoal(householdId, accessToken, refreshToken);
    
    if (!emergencyFundGoal) {
      // Create emergency fund goal if it doesn't exist
      const id = crypto.randomUUID();
      const now = formatTimestamp(new Date());
      
      emergencyFundGoal = await this.repository.create({
        id,
        name: "Emergency Funds",
        targetAmount: 0,
        currentBalance: 0,
        incomePercentage: 0,
        priority: "High",
        description: "Emergency fund for unexpected expenses",
        isPaused: false,
        isCompleted: false,
        completedAt: null,
        expectedIncome: null,
        targetMonths: null,
        accountId: null,
        holdingId: null,
        isSystemGoal: true,
        userId: user.id,
        householdId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Calculate monthly income (use predicted/expected income if available)
    let monthlyIncome = await this.calculateIncomeBasis(undefined, accessToken, refreshToken);
    
    // Get location and calculate after-tax income if available
    // Note: supabase and user are already defined above, and householdId is already available
    if (householdId && monthlyIncome > 0) {
      const { HouseholdRepository } = await import("@/src/infrastructure/database/repositories/household.repository");
      const householdRepository = new HouseholdRepository();
      const settings = await householdRepository.getSettings(householdId, accessToken, refreshToken);
      
      if (settings?.country && settings?.stateOrProvince) {
        try {
          const { makeTaxesService } = await import("../taxes/taxes.factory");
          const taxesService = makeTaxesService();
          const annualIncome = monthlyIncome * 12;
          const monthlyAfterTax = await taxesService.calculateMonthlyAfterTaxIncome(
            settings.country,
            annualIncome,
            settings.stateOrProvince
          );
          monthlyIncome = monthlyAfterTax;
          logger.info(`[GoalsService] Using after-tax income for emergency fund: $${monthlyAfterTax.toFixed(2)}/month (from $${(annualIncome / 12).toFixed(2)}/month gross)`);
        } catch (error) {
          logger.warn(`[GoalsService] Failed to calculate after-tax income, using gross income:`, error);
          // Continue with gross income if tax calculation fails
        }
      }
    }
    
    // Calculate monthly expenses
    const monthlyExpenses = await this.calculateMonthlyExpenses(accessToken, refreshToken);

    // If we don't have enough data, return the goal as-is
    if (monthlyIncome <= 0 && monthlyExpenses <= 0) {
      logger.info("[GoalsService] Insufficient data to calculate emergency fund - income and expenses are both 0");
      return GoalsMapper.toDomain(emergencyFundGoal);
    }

    // Use expenses to calculate target if available, otherwise use income as fallback
    const targetMonthlyAmount = monthlyExpenses > 0 ? monthlyExpenses : monthlyIncome * 0.8; // Assume 80% of income as expenses if no expense data
    const targetAmount = targetMonthlyAmount * 6; // 6 months of expenses (financial best practice)

    // Calculate income percentage for savings
    // Best practice: 10-20% of income for emergency fund savings, but ensure it's sustainable
    // If income is low, use a smaller percentage to avoid hurting cost of living
    let incomePercentage = 0;
    
    if (monthlyIncome > 0) {
      // Calculate how much we need to save per month to reach target in reasonable time
      const remainingAmount = Math.max(0, targetAmount - (emergencyFundGoal.currentBalance || 0));
      
      // Target: reach goal in 2-3 years (24-36 months) if not already reached
      const targetMonths = remainingAmount > 0 ? 30 : 0; // 30 months average
      const monthlyContributionNeeded = remainingAmount > 0 ? remainingAmount / targetMonths : 0;
      
      // Calculate percentage, but cap it at 20% to avoid hurting cost of living
      // Also ensure minimum of 5% if income allows
      const calculatedPercentage = (monthlyContributionNeeded / monthlyIncome) * 100;
      
      // Apply best practice constraints: 5% minimum, 20% maximum
      // If calculated is too high, cap at 20%
      // If calculated is too low but we have room, use at least 5%
      incomePercentage = Math.max(5, Math.min(20, calculatedPercentage));
      
      // If the goal is already reached or very close, set to 0 or minimal amount
      if (remainingAmount <= 0 || (emergencyFundGoal.currentBalance || 0) >= targetAmount * 0.95) {
        incomePercentage = 0;
      }
    }

    // Update the goal
    const isCompleted = (emergencyFundGoal.currentBalance || 0) >= targetAmount;
    
    const updatedGoal = await this.repository.update(emergencyFundGoal.id, {
      targetAmount,
      incomePercentage,
      targetMonths: 6, // 6 months target
      isCompleted,
      completedAt: isCompleted && !emergencyFundGoal.completedAt ? formatTimestamp(new Date()) : emergencyFundGoal.completedAt,
      updatedAt: formatTimestamp(new Date()),
    });


    logger.info(`[GoalsService] Updated emergency fund goal: target=${targetAmount.toFixed(2)}, incomePercentage=${incomePercentage.toFixed(2)}%, monthlyIncome=${monthlyIncome.toFixed(2)}, monthlyExpenses=${monthlyExpenses.toFixed(2)}`);

    return GoalsMapper.toDomain(updatedGoal);
  }

  /**
   * Ensure emergency fund goal exists
   * Creates it if it doesn't exist, or returns existing one
   */
  async ensureEmergencyFundGoal(userId: string, householdId: string): Promise<BaseGoal | null> {
    try {
      // Check if emergency fund goal already exists
      const existingGoal = await this.repository.findEmergencyFundGoal(householdId);

      if (existingGoal) {
        // Check for duplicates
        const supabase = await createServerClient();
        const { data: allEmergencyGoals, error: checkError } = await supabase
          .from("Goal")
          .select("id")
          .eq("householdId", householdId)
          .eq("name", "Emergency Funds")
          .eq("isSystemGoal", true);

        if (checkError) {
          logger.error("[GoalsService] Error checking for duplicate emergency fund goals:", checkError);
        } else if (allEmergencyGoals && allEmergencyGoals.length > 1) {
          // Delete duplicates, keep the first one
          logger.warn(`[GoalsService] Found ${allEmergencyGoals.length} duplicate emergency fund goals. Cleaning up...`);
          const goalToKeep = existingGoal.id;
          const duplicateIds = allEmergencyGoals
            .filter(g => g.id !== goalToKeep)
            .map(g => g.id);

          if (duplicateIds.length > 0) {
            for (const id of duplicateIds) {
              try {
                await this.repository.delete(id);
              } catch (deleteError) {
                logger.error(`[GoalsService] Error deleting duplicate emergency fund goal ${id}:`, deleteError);
              }
            }
            logger.log(`[GoalsService] Deleted ${duplicateIds.length} duplicate emergency fund goals`);
          }
        }

        return GoalsMapper.toDomain(existingGoal);
      }

      // No goal exists, create new emergency fund goal
      const goal = await this.createGoal({
        name: "Emergency Funds",
        targetAmount: 0.00,
        currentBalance: 0.00,
        incomePercentage: 0.00,
        priority: "High",
        targetMonths: 0,
        description: "Emergency fund for unexpected expenses",
        isPaused: false,
        isSystemGoal: true,
      });

      return goal;
    } catch (error) {
      logger.error("[GoalsService] Error ensuring emergency fund goal:", error);
      return null;
    }
  }
}

