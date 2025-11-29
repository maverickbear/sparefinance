/**
 * Debts Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseDebt, DebtWithCalculations } from "../../domain/debts/debts.types";
import { DebtRow } from "../../infrastructure/database/repositories/debts.repository";

export class DebtsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: DebtRow): BaseDebt {
    return {
      id: row.id,
      name: row.name,
      loanType: row.loanType as BaseDebt["loanType"],
      initialAmount: row.initialAmount,
      downPayment: row.downPayment,
      currentBalance: row.currentBalance,
      interestRate: row.interestRate,
      totalMonths: row.totalMonths,
      firstPaymentDate: row.firstPaymentDate,
      monthlyPayment: row.monthlyPayment,
      paymentFrequency: row.paymentFrequency as BaseDebt["paymentFrequency"],
      paymentAmount: row.paymentAmount,
      principalPaid: row.principalPaid,
      interestPaid: row.interestPaid,
      additionalContributions: row.additionalContributions,
      additionalContributionAmount: row.additionalContributionAmount,
      priority: row.priority,
      description: row.description,
      accountId: row.accountId,
      isPaidOff: row.isPaidOff,
      isPaused: row.isPaused,
      paidOffAt: row.paidOffAt,
      status: row.status,
      nextDueDate: row.nextDueDate,
      userId: row.userId,
      householdId: row.householdId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseDebt>): Partial<DebtRow> {
    return {
      id: domain.id,
      name: domain.name,
      loanType: domain.loanType,
      initialAmount: domain.initialAmount,
      downPayment: domain.downPayment ?? 0,
      currentBalance: domain.currentBalance ?? 0,
      interestRate: domain.interestRate ?? 0,
      totalMonths: domain.totalMonths ?? null,
      firstPaymentDate: domain.firstPaymentDate,
      monthlyPayment: domain.monthlyPayment ?? 0,
      paymentFrequency: domain.paymentFrequency ?? "monthly",
      paymentAmount: domain.paymentAmount ?? null,
      principalPaid: domain.principalPaid ?? 0,
      interestPaid: domain.interestPaid ?? 0,
      additionalContributions: domain.additionalContributions ?? false,
      additionalContributionAmount: domain.additionalContributionAmount ?? null,
      priority: domain.priority ?? "Medium",
      description: domain.description ?? null,
      accountId: domain.accountId ?? null,
      isPaidOff: domain.isPaidOff ?? false,
      isPaused: domain.isPaused ?? false,
      paidOffAt: domain.paidOffAt ?? null,
      status: domain.status ?? null,
      nextDueDate: domain.nextDueDate ?? null,
      userId: domain.userId!,
      householdId: domain.householdId ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }

  /**
   * Map repository row to domain entity with calculations
   */
  static toDomainWithCalculations(
    row: DebtRow,
    calculations: {
      remainingBalance: number;
      remainingPrincipal: number;
      monthsRemaining: number | null;
      totalInterestPaid: number;
      totalInterestRemaining: number;
      progressPct: number;
    }
  ): DebtWithCalculations {
    return {
      ...this.toDomain(row),
      remainingBalance: calculations.remainingBalance,
      remainingPrincipal: calculations.remainingPrincipal,
      monthsRemaining: calculations.monthsRemaining,
      totalInterestPaid: calculations.totalInterestPaid,
      totalInterestRemaining: calculations.totalInterestRemaining,
      progressPct: calculations.progressPct,
    };
  }
}

