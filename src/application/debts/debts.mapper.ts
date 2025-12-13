/**
 * Debts Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseDebt, DebtWithCalculations } from "../../domain/debts/debts.types";
import { DebtRow } from "@/src/infrastructure/database/repositories/debts.repository";

export class DebtsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: DebtRow): BaseDebt {
    return {
      id: row.id,
      name: row.name,
      loanType: row.loan_type as BaseDebt["loanType"],
      initialAmount: row.initial_amount,
      downPayment: row.down_payment,
      currentBalance: row.current_balance,
      interestRate: row.interest_rate,
      totalMonths: row.total_months,
      firstPaymentDate: row.first_payment_date,
      monthlyPayment: row.monthly_payment,
      paymentFrequency: row.payment_frequency as BaseDebt["paymentFrequency"],
      paymentAmount: row.payment_amount,
      principalPaid: row.principal_paid,
      interestPaid: row.interest_paid,
      additionalContributions: row.additional_contributions,
      additionalContributionAmount: row.additional_contribution_amount,
      priority: row.priority,
      description: row.description,
      accountId: row.account_id,
      isPaidOff: row.is_paid_off,
      isPaused: row.is_paused,
      paidOffAt: row.paid_off_at,
      status: row.status,
      nextDueDate: row.next_due_date,
      userId: row.user_id,
      householdId: row.household_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseDebt>): Partial<DebtRow> {
    return {
      id: domain.id,
      name: domain.name,
      loan_type: domain.loanType,
      initial_amount: domain.initialAmount,
      down_payment: domain.downPayment ?? 0,
      current_balance: domain.currentBalance ?? 0,
      interest_rate: domain.interestRate ?? 0,
      total_months: domain.totalMonths ?? null,
      first_payment_date: domain.firstPaymentDate,
      monthly_payment: domain.monthlyPayment ?? 0,
      payment_frequency: domain.paymentFrequency ?? "monthly",
      payment_amount: domain.paymentAmount ?? null,
      principal_paid: domain.principalPaid ?? 0,
      interest_paid: domain.interestPaid ?? 0,
      additional_contributions: domain.additionalContributions ?? false,
      additional_contribution_amount: domain.additionalContributionAmount ?? null,
      priority: domain.priority ?? "Medium",
      description: domain.description ?? null,
      account_id: domain.accountId ?? null,
      is_paid_off: domain.isPaidOff ?? false,
      is_paused: domain.isPaused ?? false,
      paid_off_at: domain.paidOffAt ?? null,
      status: domain.status ?? null,
      next_due_date: domain.nextDueDate ?? null,
      user_id: domain.userId!,
      household_id: domain.householdId ?? null,
      created_at: domain.createdAt,
      updated_at: domain.updatedAt,
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

