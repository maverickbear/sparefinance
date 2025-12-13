/**
 * Debts Repository
 * Data access layer for debts - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { BaseDebt } from "../../../domain/debts/debts.types";
import { logger } from "@/lib/utils/logger";

export interface DebtRow {
  id: string;
  name: string;
  loan_type: string;
  initial_amount: number;
  down_payment: number;
  current_balance: number;
  interest_rate: number;
  total_months: number | null;
  first_payment_date: string;
  monthly_payment: number;
  payment_frequency: string;
  payment_amount: number | null;
  principal_paid: number;
  interest_paid: number;
  additional_contributions: boolean;
  additional_contribution_amount: number | null;
  priority: "High" | "Medium" | "Low";
  description: string | null;
  account_id: string | null;
  is_paid_off: boolean;
  is_paused: boolean;
  paid_off_at: string | null;
  status: string | null;
  next_due_date: string | null;
  user_id: string;
  household_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export class DebtsRepository {
  /**
   * Find all debts for a user
   */
  async findAll(
    accessToken?: string,
    refreshToken?: string
  ): Promise<DebtRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: debts, error } = await supabase
      .from("debts")
      .select("id, name, loan_type, initial_amount, down_payment, current_balance, interest_rate, total_months, first_payment_date, monthly_payment, payment_frequency, payment_amount, principal_paid, interest_paid, additional_contributions, additional_contribution_amount, priority, description, account_id, is_paid_off, is_paused, paid_off_at, status, next_due_date, created_at, updated_at, user_id, household_id, deleted_at")
      .is("deleted_at", null) // Exclude soft-deleted records
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      // Handle RLS permission denied errors more gracefully
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        logger.warn("[DebtsRepository] Permission denied - user may not be authenticated or tokens may be invalid:", {
          code: error.code,
          message: error.message,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
        });
        // Return empty array instead of throwing - allows the app to continue
        // The calling code should handle authentication separately
        return [];
      }
      logger.error("[DebtsRepository] Error fetching debts:", error);
      throw new Error(`Failed to fetch debts: ${error.message}`);
    }

    return (debts || []) as DebtRow[];
  }

  /**
   * Find debt by ID
   */
  async findById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<DebtRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: debt, error } = await supabase
      .from("debts")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null) // Exclude soft-deleted records
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[DebtsRepository] Error fetching debt:", error);
      throw new Error(`Failed to fetch debt: ${error.message}`);
    }

    return debt as DebtRow;
  }

  /**
   * Create a new debt
   */
  async create(data: {
    id: string;
    name: string;
    loanType: string;
    initialAmount: number;
    downPayment: number;
    currentBalance: number;
    interestRate: number;
    totalMonths: number | null;
    firstPaymentDate: string;
    startDate: string;
    monthlyPayment: number;
    paymentFrequency: string;
    paymentAmount: number | null;
    principalPaid: number;
    interestPaid: number;
    additionalContributions: boolean;
    additionalContributionAmount: number | null;
    priority: "High" | "Medium" | "Low";
    description: string | null;
    accountId: string | null;
    isPaidOff: boolean;
    isPaused: boolean;
    paidOffAt: string | null;
    status: string | null;
    nextDueDate: string | null;
    userId: string;
    householdId: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<DebtRow> {
    const supabase = await createServerClient();

    const { data: debt, error } = await supabase
      .from("debts")
      .insert({
        id: data.id,
        name: data.name,
        loan_type: data.loanType,
        initial_amount: data.initialAmount,
        down_payment: data.downPayment,
        current_balance: data.currentBalance,
        interest_rate: data.interestRate,
        total_months: data.totalMonths,
        first_payment_date: data.firstPaymentDate,
        start_date: data.startDate,
        monthly_payment: data.monthlyPayment,
        payment_frequency: data.paymentFrequency,
        payment_amount: data.paymentAmount,
        principal_paid: data.principalPaid,
        interest_paid: data.interestPaid,
        additional_contributions: data.additionalContributions,
        additional_contribution_amount: data.additionalContributionAmount,
        priority: data.priority,
        description: data.description,
        account_id: data.accountId,
        is_paid_off: data.isPaidOff,
        is_paused: data.isPaused,
        paid_off_at: data.paidOffAt,
        status: data.status,
        next_due_date: data.nextDueDate,
        user_id: data.userId,
        household_id: data.householdId,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("[DebtsRepository] Error creating debt:", error);
      throw new Error(`Failed to create debt: ${error.message}`);
    }

    return debt as DebtRow;
  }

  /**
   * Update a debt
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      currentBalance: number;
      interestRate: number;
      totalMonths: number | null;
      firstPaymentDate: string;
      monthlyPayment: number;
      paymentFrequency: string;
      paymentAmount: number | null;
      principalPaid: number;
      interestPaid: number;
      additionalContributions: boolean;
      additionalContributionAmount: number | null;
      priority: "High" | "Medium" | "Low";
      description: string | null;
      accountId: string | null;
      isPaidOff: boolean;
      isPaused: boolean;
      paidOffAt: string | null;
      status: string | null;
      nextDueDate: string | null;
      updatedAt: string;
    }>
  ): Promise<DebtRow> {
    const supabase = await createServerClient();

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.currentBalance !== undefined) updateData.current_balance = data.currentBalance;
    if (data.interestRate !== undefined) updateData.interest_rate = data.interestRate;
    if (data.totalMonths !== undefined) updateData.total_months = data.totalMonths;
    if (data.firstPaymentDate !== undefined) updateData.first_payment_date = data.firstPaymentDate;
    if (data.monthlyPayment !== undefined) updateData.monthly_payment = data.monthlyPayment;
    if (data.paymentFrequency !== undefined) updateData.payment_frequency = data.paymentFrequency;
    if (data.paymentAmount !== undefined) updateData.payment_amount = data.paymentAmount;
    if (data.principalPaid !== undefined) updateData.principal_paid = data.principalPaid;
    if (data.interestPaid !== undefined) updateData.interest_paid = data.interestPaid;
    if (data.additionalContributions !== undefined) updateData.additional_contributions = data.additionalContributions;
    if (data.additionalContributionAmount !== undefined) updateData.additional_contribution_amount = data.additionalContributionAmount;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.accountId !== undefined) updateData.account_id = data.accountId;
    if (data.isPaidOff !== undefined) updateData.is_paid_off = data.isPaidOff;
    if (data.isPaused !== undefined) updateData.is_paused = data.isPaused;
    if (data.paidOffAt !== undefined) updateData.paid_off_at = data.paidOffAt;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.nextDueDate !== undefined) updateData.next_due_date = data.nextDueDate;
    if (data.updatedAt !== undefined) updateData.updated_at = data.updatedAt;

    const { data: debt, error } = await supabase
      .from("debts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[DebtsRepository] Error updating debt:", error);
      throw new Error(`Failed to update debt: ${error.message}`);
    }

    return debt as DebtRow;
  }

  /**
   * Soft delete a debt
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("debts")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", id)
      .is("deleted_at", null); // Only soft-delete if not already deleted

    if (error) {
      logger.error("[DebtsRepository] Error soft-deleting debt:", error);
      throw new Error(`Failed to delete debt: ${error.message}`);
    }
  }
}

