"use client";

import { supabase } from "@/lib/supabase";

export interface Debt {
  id: string;
  name: string;
  loanType: string;
  initialAmount: number;
  downPayment: number;
  currentBalance: number;
  interestRate: number;
  totalMonths: number;
  firstPaymentDate: string;
  monthlyPayment: number;
  paymentFrequency?: string;
  paymentAmount?: number | null;
  principalPaid: number;
  interestPaid: number;
  additionalContributions: boolean;
  additionalContributionAmount?: number | null;
  priority: "High" | "Medium" | "Low";
  description?: string | null;
  accountId?: string | null;
  isPaidOff: boolean;
  isPaused: boolean;
  paidOffAt?: string | null;
  createdAt: string;
  updatedAt: string;
  remainingBalance?: number;
  remainingPrincipal?: number;
  monthsRemaining?: number | null;
  totalInterestPaid?: number;
  totalInterestRemaining?: number;
  progressPct?: number;
}

/**
 * Get all debts
 */
export async function getDebtsClient(): Promise<Debt[]> {
  const { data: debts, error } = await supabase
    .from("Debt")
    .select("*")
    .order("priority", { ascending: false })
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Supabase error fetching debts:", error);
    return [];
  }

  return debts || [];
}

/**
 * Update a debt
 */
export async function updateDebtClient(id: string, data: Partial<Debt>): Promise<Debt> {
  const updateData: Record<string, unknown> = { ...data };
  updateData.updatedAt = new Date().toISOString();

  const { data: debt, error } = await supabase
    .from("Debt")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase error updating debt:", error);
    throw new Error(`Failed to update debt: ${error.message || JSON.stringify(error)}`);
  }

  return debt;
}

/**
 * Delete a debt
 */
export async function deleteDebtClient(id: string): Promise<void> {
  const { error } = await supabase.from("Debt").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting debt:", error);
    throw new Error(`Failed to delete debt: ${error.message || JSON.stringify(error)}`);
  }
}

/**
 * Add a payment to a debt
 * Note: This is a simplified version. For full payment calculation logic,
 * use the server action from lib/api/debts.ts
 */
export async function addPaymentClient(id: string, amount: number): Promise<Debt> {
  if (amount <= 0) {
    throw new Error("Payment amount must be positive");
  }

  // Get current debt
  const { data: debt, error: fetchError } = await supabase
    .from("Debt")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !debt) {
    throw new Error("Debt not found");
  }

  if (debt.isPaidOff || debt.currentBalance <= 0) {
    throw new Error("Debt is already paid off");
  }

  // Simple payment: reduce current balance
  const newBalance = Math.max(0, debt.currentBalance - amount);
  const isPaidOff = newBalance <= 0;

  const updateData: Record<string, unknown> = {
    currentBalance: newBalance,
    isPaidOff,
    updatedAt: new Date().toISOString(),
  };

  if (isPaidOff && !debt.paidOffAt) {
    updateData.paidOffAt = new Date().toISOString();
  }

  const { data: updatedDebt, error } = await supabase
    .from("Debt")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase error adding payment:", error);
    throw new Error(`Failed to add payment: ${error.message || JSON.stringify(error)}`);
  }

  return updatedDebt;
}

