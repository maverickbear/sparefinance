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
  loanType: string;
  initialAmount: number;
  downPayment: number;
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
  userId: string;
  householdId: string | null;
  createdAt: string;
  updatedAt: string;
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
      .from("Debt")
      .select("id, name, loanType, initialAmount, downPayment, currentBalance, interestRate, totalMonths, firstPaymentDate, monthlyPayment, paymentFrequency, paymentAmount, principalPaid, interestPaid, additionalContributions, additionalContributionAmount, priority, description, accountId, isPaidOff, isPaused, paidOffAt, status, nextDueDate, createdAt, updatedAt, userId, householdId")
      .order("priority", { ascending: false })
      .order("createdAt", { ascending: false });

    if (error) {
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
      .from("Debt")
      .select("*")
      .eq("id", id)
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
      .from("Debt")
      .insert({
        id: data.id,
        name: data.name,
        loanType: data.loanType,
        initialAmount: data.initialAmount,
        downPayment: data.downPayment,
        currentBalance: data.currentBalance,
        interestRate: data.interestRate,
        totalMonths: data.totalMonths,
        firstPaymentDate: data.firstPaymentDate,
        startDate: data.startDate,
        monthlyPayment: data.monthlyPayment,
        paymentFrequency: data.paymentFrequency,
        paymentAmount: data.paymentAmount,
        principalPaid: data.principalPaid,
        interestPaid: data.interestPaid,
        additionalContributions: data.additionalContributions,
        additionalContributionAmount: data.additionalContributionAmount,
        priority: data.priority,
        description: data.description,
        accountId: data.accountId,
        isPaidOff: data.isPaidOff,
        isPaused: data.isPaused,
        paidOffAt: data.paidOffAt,
        status: data.status,
        nextDueDate: data.nextDueDate,
        userId: data.userId,
        householdId: data.householdId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
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

    const { data: debt, error } = await supabase
      .from("Debt")
      .update(data)
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
   * Delete a debt
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Debt")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[DebtsRepository] Error deleting debt:", error);
      throw new Error(`Failed to delete debt: ${error.message}`);
    }
  }
}

