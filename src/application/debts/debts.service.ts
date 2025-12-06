/**
 * Debts Service
 * Business logic for debt management
 */

import { DebtsRepository } from "@/src/infrastructure/database/repositories/debts.repository";
import { DebtsMapper } from "./debts.mapper";
import { DebtFormData } from "../../domain/debts/debts.validations";
import { BaseDebt, DebtWithCalculations } from "../../domain/debts/debts.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { requireDebtOwnership } from "@/src/infrastructure/utils/security";
import { logger } from "@/src/infrastructure/utils/logger";
import {
  calculateDebtMetrics,
  calculatePaymentsFromDate,
  type DebtForCalculation,
} from "@/lib/utils/debts";
import { AppError } from "../shared/app-error";
import { DebtPlannedPaymentsService } from "../planned-payments/debt-planned-payments.service";

export class DebtsService {
  private debtPlannedPaymentsService: DebtPlannedPaymentsService;

  constructor(private repository: DebtsRepository) {
    this.debtPlannedPaymentsService = new DebtPlannedPaymentsService();
  }

  /**
   * Get all debts with calculations
   */
  async getDebts(
    accessToken?: string,
    refreshToken?: string
  ): Promise<DebtWithCalculations[]> {
    const rows = await this.repository.findAll(accessToken, refreshToken);

    if (rows.length === 0) {
      return [];
    }

    // Calculate metrics for each debt and update if needed
    const debtsWithCalculations: DebtWithCalculations[] = await Promise.all(
      rows.map(async (debt) => {
        const debtForCalculation: DebtForCalculation = {
          id: debt.id,
          name: debt.name,
          initialAmount: debt.initialAmount,
          downPayment: debt.downPayment,
          currentBalance: debt.currentBalance,
          interestRate: debt.interestRate,
          totalMonths: debt.totalMonths,
          firstPaymentDate: debt.firstPaymentDate,
          monthlyPayment: debt.monthlyPayment,
          paymentFrequency: debt.paymentFrequency as any,
          paymentAmount: debt.paymentAmount,
          principalPaid: debt.principalPaid,
          interestPaid: debt.interestPaid,
          additionalContributions: debt.additionalContributions,
          additionalContributionAmount: debt.additionalContributionAmount,
          priority: debt.priority,
          isPaused: debt.isPaused,
          isPaidOff: debt.isPaidOff,
          description: debt.description,
        };

        // Calculate payments based on date
        const calculatedPayments = calculatePaymentsFromDate(debtForCalculation);
        
        // Update debt in database if calculated values are different
        const needsUpdate = 
          Math.abs(calculatedPayments.principalPaid - debt.principalPaid) > 0.01 ||
          Math.abs(calculatedPayments.interestPaid - debt.interestPaid) > 0.01 ||
          Math.abs(calculatedPayments.currentBalance - debt.currentBalance) > 0.01;

        if (needsUpdate && !debt.isPaused && !debt.isPaidOff) {
          const newBalance = Math.max(0, calculatedPayments.currentBalance);
          const isPaidOff = newBalance <= 0;

          try {
            await this.repository.update(debt.id, {
              principalPaid: calculatedPayments.principalPaid,
              interestPaid: calculatedPayments.interestPaid,
              currentBalance: newBalance,
              isPaidOff,
              paidOffAt: isPaidOff && !debt.paidOffAt ? formatTimestamp(new Date()) : debt.paidOffAt,
              updatedAt: formatTimestamp(new Date()),
            });
            
            // Use updated values
            debt.principalPaid = calculatedPayments.principalPaid;
            debt.interestPaid = calculatedPayments.interestPaid;
            debt.currentBalance = newBalance;
            debt.isPaidOff = isPaidOff;
          } catch (error) {
            logger.error(`[DebtsService] Error updating debt ${debt.id}:`, error);
          }
        }

        // Use updated debt values for calculations
        const updatedDebtForCalculation: DebtForCalculation = {
          ...debtForCalculation,
          principalPaid: debt.principalPaid,
          interestPaid: debt.interestPaid,
          currentBalance: debt.currentBalance,
          isPaidOff: debt.isPaidOff,
        };

        const metrics = calculateDebtMetrics(updatedDebtForCalculation);

        return DebtsMapper.toDomainWithCalculations(debt, metrics);
      })
    );

    return debtsWithCalculations;
  }

  /**
   * Get debt by ID
   */
  async getDebtById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<DebtWithCalculations | null> {
    const row = await this.repository.findById(id, accessToken, refreshToken);
    
    if (!row) {
      return null;
    }

    const debtForCalculation: DebtForCalculation = {
      id: row.id,
      name: row.name,
      initialAmount: row.initialAmount,
      downPayment: row.downPayment,
      currentBalance: row.currentBalance,
      interestRate: row.interestRate,
      totalMonths: row.totalMonths,
      firstPaymentDate: row.firstPaymentDate,
      monthlyPayment: row.monthlyPayment,
      paymentFrequency: row.paymentFrequency as any,
      paymentAmount: row.paymentAmount,
      principalPaid: row.principalPaid,
      interestPaid: row.interestPaid,
      additionalContributions: row.additionalContributions,
      additionalContributionAmount: row.additionalContributionAmount,
      priority: row.priority,
      isPaused: row.isPaused,
      isPaidOff: row.isPaidOff,
      description: row.description,
    };

    const metrics = calculateDebtMetrics(debtForCalculation);

    return DebtsMapper.toDomainWithCalculations(row, metrics);
  }

  /**
   * Create a new debt
   */
  async createDebt(data: DebtFormData): Promise<BaseDebt> {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new AppError("Unauthorized", 401);
    }

    const downPayment = data.downPayment ?? 0;
    const principalPaid = 0;
    const interestPaid = 0;
    const initialBalance = data.initialAmount - downPayment;
    const isPaidOff = initialBalance <= 0;

    // Get active household ID
    const householdId = await getActiveHouseholdId(user.id);
    if (!householdId) {
      throw new AppError("No active household found. Please contact support.", 400);
    }

    const id = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    const firstPaymentDate = data.firstPaymentDate 
      ? (data.firstPaymentDate instanceof Date 
          ? formatDateOnly(data.firstPaymentDate)
          : formatDateOnly(new Date(data.firstPaymentDate)))
      : formatDateOnly(new Date());
    
    const startDate = data.startDate instanceof Date
      ? formatDateOnly(data.startDate)
      : (data.startDate ? formatDateOnly(new Date(data.startDate)) : firstPaymentDate);

    const debtRow = await this.repository.create({
      id,
      name: data.name,
      loanType: data.loanType,
      initialAmount: data.initialAmount,
      downPayment,
      currentBalance: initialBalance,
      interestRate: data.interestRate ?? 0,
      totalMonths: data.totalMonths ?? null,
      firstPaymentDate,
      startDate,
      monthlyPayment: data.monthlyPayment ?? 0,
      paymentFrequency: data.paymentFrequency ?? "monthly",
      paymentAmount: data.paymentAmount ?? null,
      principalPaid,
      interestPaid,
      additionalContributions: data.additionalContributions ?? false,
      additionalContributionAmount: data.additionalContributionAmount ?? null,
      priority: data.priority ?? "Medium",
      description: data.description || null,
      accountId: data.accountId || null,
      isPaidOff,
      isPaused: data.isPaused ?? false,
      paidOffAt: isPaidOff ? now : null,
      status: null,
      nextDueDate: null,
      userId: user.id,
      householdId,
      createdAt: now,
      updatedAt: now,
    });

    const debt = DebtsMapper.toDomain(debtRow);

    // Generate planned payments for the debt (async, don't wait)
    if (!isPaidOff && !data.isPaused && debtRow.accountId) {
      this.debtPlannedPaymentsService
        .generatePlannedPaymentsForDebt({
          ...debt,
          isPaidOff,
          isPaused: data.isPaused ?? false,
        } as DebtWithCalculations)
        .catch((error) => {
          logger.error(
            `[DebtsService] Error generating planned payments for debt ${debt.id}:`,
            error
          );
        });
    }

    return debt;
  }

  /**
   * Update a debt
   */
  async updateDebt(
    id: string,
    data: Partial<DebtFormData>
  ): Promise<BaseDebt> {
    // Verify ownership
    await requireDebtOwnership(id);

    // Get current debt
    const currentDebt = await this.repository.findById(id);
    if (!currentDebt) {
      throw new AppError("Debt not found", 404);
    }

    // Use provided values or keep existing ones
    const effectiveCurrentBalance = data.currentBalance !== undefined
      ? data.currentBalance
      : currentDebt.currentBalance;

    // Check if debt should be marked as paid off
    const isPaidOff = effectiveCurrentBalance <= 0;

    const updateData: any = {
      updatedAt: formatTimestamp(new Date()),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.loanType !== undefined) updateData.loanType = data.loanType;
    if (data.initialAmount !== undefined) updateData.initialAmount = data.initialAmount;
    if (data.downPayment !== undefined) updateData.downPayment = data.downPayment;
    if (data.currentBalance !== undefined) updateData.currentBalance = data.currentBalance;
    if (data.interestRate !== undefined) updateData.interestRate = data.interestRate;
    if (data.totalMonths !== undefined) updateData.totalMonths = data.totalMonths;
    if (data.firstPaymentDate !== undefined) {
      updateData.firstPaymentDate = formatDateOnly(
        data.firstPaymentDate instanceof Date 
          ? data.firstPaymentDate 
          : new Date(data.firstPaymentDate)
      );
    }
    if (data.startDate !== undefined) {
      updateData.startDate = formatDateOnly(
        data.startDate instanceof Date 
          ? data.startDate 
          : new Date(data.startDate)
      );
    }
    if (data.monthlyPayment !== undefined) updateData.monthlyPayment = data.monthlyPayment;
    if (data.paymentFrequency !== undefined) updateData.paymentFrequency = data.paymentFrequency;
    if (data.paymentAmount !== undefined) updateData.paymentAmount = data.paymentAmount ?? null;
    if (data.additionalContributions !== undefined) updateData.additionalContributions = data.additionalContributions;
    if (data.additionalContributionAmount !== undefined) updateData.additionalContributionAmount = data.additionalContributionAmount ?? null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.accountId !== undefined) updateData.accountId = data.accountId || null;
    if (data.isPaused !== undefined) updateData.isPaused = data.isPaused;

    // Update completion status
    updateData.isPaidOff = isPaidOff;
    if (isPaidOff && !currentDebt.paidOffAt) {
      updateData.paidOffAt = formatTimestamp(new Date());
    } else if (!isPaidOff && currentDebt.paidOffAt) {
      updateData.paidOffAt = null;
    }

    const debtRow = await this.repository.update(id, updateData);

    const debt = DebtsMapper.toDomain(debtRow);

    // Sync planned payments for the debt (async, don't wait)
    const debtWithCalculations = await this.getDebtById(id);
    if (debtWithCalculations) {
      this.debtPlannedPaymentsService
        .syncPlannedPaymentsForDebt(debtWithCalculations)
        .catch((error) => {
          logger.error(
            `[DebtsService] Error syncing planned payments for debt ${id}:`,
            error
          );
        });
    }

    return debt;
  }

  /**
   * Delete a debt
   */
  async deleteDebt(id: string): Promise<void> {
    // Verify ownership
    await requireDebtOwnership(id);

    await this.repository.delete(id);

  }

  /**
   * Add payment to debt
   */
  async addPayment(id: string, paymentAmount: number): Promise<BaseDebt> {
    // Verify ownership
    await requireDebtOwnership(id);

    const debt = await this.repository.findById(id);
    if (!debt) {
      throw new AppError("Debt not found", 404);
    }

    if (debt.isPaidOff) {
      throw new AppError("Debt is already paid off", 400);
    }

    // Calculate new balance
    const newBalance = Math.max(0, debt.currentBalance - paymentAmount);
    const principalReduction = Math.min(paymentAmount, debt.currentBalance);
    const newPrincipalPaid = debt.principalPaid + principalReduction;
    const isPaidOff = newBalance <= 0;

    const debtRow = await this.repository.update(id, {
      currentBalance: newBalance,
      principalPaid: newPrincipalPaid,
      isPaidOff,
      paidOffAt: isPaidOff && !debt.paidOffAt ? formatTimestamp(new Date()) : debt.paidOffAt,
      updatedAt: formatTimestamp(new Date()),
    });


    return DebtsMapper.toDomain(debtRow);
  }
}

