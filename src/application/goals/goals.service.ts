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
import { invalidateGoalCaches } from "@/src/infrastructure/cache/cache.manager";
import { calculateProgress } from "@/lib/utils/goals";
import { startOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { getTransactionAmount } from "@/lib/utils/transaction-encryption";

export class GoalsService {
  constructor(private repository: GoalsRepository) {}

  /**
   * Calculate income basis from last 3 months of income transactions
   */
  async calculateIncomeBasis(
    expectedIncome?: number | null,
    accessToken?: string,
    refreshToken?: string
  ): Promise<number> {
    if (expectedIncome && expectedIncome > 0) {
      return expectedIncome;
    }

    const supabase = await createServerClient(accessToken, refreshToken);
    const now = new Date();
    const currentMonth = startOfMonth(now);
    
    // Get last 3 months
    const months = eachMonthOfInterval({
      start: subMonths(currentMonth, 3),
      end: currentMonth,
    });

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
        
        return monthIncome;
      })
    );

    // Calculate average
    const totalIncome = monthlyIncomes.reduce((sum, income) => sum + income, 0);
    return monthlyIncomes.length > 0 ? totalIncome / monthlyIncomes.length : 0;
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
   */
  async getGoals(
    accessToken?: string,
    refreshToken?: string
  ): Promise<GoalWithCalculations[]> {
    const rows = await this.repository.findAll(accessToken, refreshToken);

    if (rows.length === 0) {
      return [];
    }

    // Calculate income basis
    const incomeBasis = await this.calculateIncomeBasis(undefined, accessToken, refreshToken);

    // Get accounts for goals with accountId (temporary import until Accounts is fully integrated)
    const goalsWithAccount = rows.filter(g => g.accountId);
    const accountsMap = new Map<string, any>();
    
    if (goalsWithAccount.length > 0) {
      const { makeAccountsService } = await import("../accounts/accounts.factory");
      const accountsService = makeAccountsService();
      const accounts = await accountsService.getAccounts(accessToken, refreshToken, { includeHoldings: false });
      
      accounts.forEach(acc => {
        accountsMap.set(acc.id, acc);
      });
    }

    // Calculate progress for each goal and sync balances
    const goalsWithCalculations: GoalWithCalculations[] = await Promise.all(
      rows.map(async (goal) => {
        let currentBalance = goal.currentBalance;
        let needsUpdate = false;

        // If goal has accountId, sync balance from account
        if (goal.accountId) {
          const account = accountsMap.get(goal.accountId);
          
          if (account) {
            // For now, use account balance (holdings support can be added later)
            const accountBalance = account.balance || 0;
            if (accountBalance !== currentBalance) {
              currentBalance = accountBalance;
              needsUpdate = true;
            }
          }
        }

        // Update balance in database if it changed
        if (needsUpdate) {
          try {
            const isCompleted = currentBalance >= goal.targetAmount;
            await this.repository.update(goal.id, {
              currentBalance,
              isCompleted,
              completedAt: isCompleted && !goal.completedAt ? formatTimestamp(new Date()) : goal.completedAt,
              updatedAt: formatTimestamp(new Date()),
            });
            
            goal.currentBalance = currentBalance;
            goal.isCompleted = isCompleted;
            if (isCompleted && !goal.completedAt) {
              goal.completedAt = formatTimestamp(new Date());
            }
          } catch (error) {
            logger.error(`[GoalsService] Error updating balance for goal ${goal.id}:`, error);
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
      throw new Error("Unauthorized");
    }

    // Validate targetAmount
    if (data.targetAmount <= 0 && !data.isSystemGoal) {
      throw new Error("Target amount must be greater than 0");
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
        throw new Error(validation.message || "Total allocation exceeds 100%");
      }
    }

    // Check if goal is already completed
    const isCompleted = data.targetAmount > 0 && (data.currentBalance || 0) >= data.targetAmount;

    // Get active household ID
    const householdId = await getActiveHouseholdId(user.id);
    if (!householdId) {
      throw new Error("No active household found. Please contact support.");
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

    // Invalidate cache
    invalidateGoalCaches();

    return GoalsMapper.toDomain(goalRow);
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
      throw new Error("Goal not found");
    }

    // Validate targetAmount
    const targetAmount = data.targetAmount ?? currentGoal.targetAmount;
    const isSystemGoal = currentGoal.isSystemGoal;
    if (data.targetAmount !== undefined && data.targetAmount <= 0 && !isSystemGoal) {
      throw new Error("Target amount must be greater than 0");
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
        throw new Error(validation.message || "Total allocation exceeds 100%");
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

    // Invalidate cache
    invalidateGoalCaches();

    return GoalsMapper.toDomain(goalRow);
  }

  /**
   * Delete a goal
   */
  async deleteGoal(id: string): Promise<void> {
    // Verify ownership
    await requireGoalOwnership(id);

    await this.repository.delete(id);

    // Invalidate cache
    invalidateGoalCaches();
  }

  /**
   * Add top-up to goal balance
   */
  async addTopUp(id: string, amount: number): Promise<BaseGoal> {
    // Verify ownership
    await requireGoalOwnership(id);

    const goal = await this.repository.findById(id);
    if (!goal) {
      throw new Error("Goal not found");
    }

    const newBalance = goal.currentBalance + amount;
    const isCompleted = newBalance >= goal.targetAmount;

    const goalRow = await this.repository.update(id, {
      currentBalance: newBalance,
      isCompleted,
      completedAt: isCompleted && !goal.completedAt ? formatTimestamp(new Date()) : goal.completedAt,
      updatedAt: formatTimestamp(new Date()),
    });

    // Invalidate cache
    invalidateGoalCaches();

    return GoalsMapper.toDomain(goalRow);
  }

  /**
   * Withdraw from goal balance
   */
  async withdraw(id: string, amount: number): Promise<BaseGoal> {
    // Verify ownership
    await requireGoalOwnership(id);

    if (amount <= 0) {
      throw new Error("Withdrawal amount must be positive");
    }

    const goal = await this.repository.findById(id);
    if (!goal) {
      throw new Error("Goal not found");
    }

    const newBalance = Math.max(0, goal.currentBalance - amount);
    const isCompleted = newBalance >= goal.targetAmount;

    const goalRow = await this.repository.update(id, {
      currentBalance: newBalance,
      isCompleted,
      completedAt: isCompleted && !goal.completedAt ? formatTimestamp(new Date()) : (isCompleted ? goal.completedAt : null),
      updatedAt: formatTimestamp(new Date()),
    });

    // Invalidate cache
    invalidateGoalCaches();

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
      throw new Error("Unauthorized");
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
    const monthlyIncome = await this.calculateIncomeBasis(undefined, accessToken, refreshToken);
    
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

    // Invalidate cache
    invalidateGoalCaches();

    logger.info(`[GoalsService] Updated emergency fund goal: target=${targetAmount.toFixed(2)}, incomePercentage=${incomePercentage.toFixed(2)}%, monthlyIncome=${monthlyIncome.toFixed(2)}, monthlyExpenses=${monthlyExpenses.toFixed(2)}`);

    return GoalsMapper.toDomain(updatedGoal);
  }
}

