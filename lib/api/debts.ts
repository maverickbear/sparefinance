"use server";

import { createServerClient } from "@/lib/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/lib/utils/timestamp";
import {
  calculateDebtMetrics,
  calculatePaymentDistribution,
  calculatePaymentsFromDate,
  getMonthlyInterestRate,
  type DebtForCalculation,
} from "@/lib/utils/debts";
import { createTransaction } from "@/lib/api/transactions";
import { getDebtCategoryMapping } from "@/lib/utils/debt-categories";
import { requireDebtOwnership } from "@/lib/utils/security";
import { addMonths } from "date-fns";

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
  paymentFrequency?: string; // "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily"
  paymentAmount?: number | null; // Payment amount based on frequency
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
  // Calculated fields
  remainingBalance?: number;
  remainingPrincipal?: number;
  monthsRemaining?: number | null;
  totalInterestPaid?: number;
  totalInterestRemaining?: number;
  progressPct?: number;
}

export interface DebtWithCalculations extends Debt {
  remainingBalance: number;
  remainingPrincipal: number;
  monthsRemaining: number | null;
  totalInterestPaid: number;
  totalInterestRemaining: number;
  progressPct: number;
}

/**
 * Get all debts with calculated metrics
 */
export async function getDebts(): Promise<DebtWithCalculations[]> {
    const supabase = await createServerClient();

  const { data: debts, error } = await supabase
    .from("Debt")
    .select("*")
    .order("priority", { ascending: false })
    .order("createdAt", { ascending: false });

  if (error) {
    // Only log non-connection errors to avoid spam
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes("ENOTFOUND") && !errorMessage.includes("fetch failed")) {
      console.error("Supabase error fetching debts:", error);
    }
    return [];
  }

  if (!debts || debts.length === 0) {
    return [];
  }

  // Calculate metrics for each debt and update if needed
  const debtsWithCalculations: DebtWithCalculations[] = await Promise.all(
    debts.map(async (debt: any) => {
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
        paymentFrequency: debt.paymentFrequency,
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

        const updateData: Record<string, unknown> = {
          principalPaid: calculatedPayments.principalPaid,
          interestPaid: calculatedPayments.interestPaid,
          currentBalance: newBalance,
          isPaidOff,
          updatedAt: formatTimestamp(new Date()),
        };

        if (isPaidOff && !debt.paidOffAt) {
          updateData.paidOffAt = formatTimestamp(new Date());
        } else if (!isPaidOff && debt.paidOffAt) {
          updateData.paidOffAt = null;
        }

        // Update in database
        const { error: updateError } = await supabase
          .from("Debt")
          .update(updateData)
          .eq("id", debt.id);

        if (updateError) {
          console.error(`Error updating debt ${debt.id}:`, updateError);
        } else {
          // Use updated values
          debt.principalPaid = calculatedPayments.principalPaid;
          debt.interestPaid = calculatedPayments.interestPaid;
          debt.currentBalance = newBalance;
          debt.isPaidOff = isPaidOff;
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

      return {
        ...debt,
        isPaidOff: debt.isPaidOff,
        ...metrics,
      };
    })
  );

  return debtsWithCalculations;
}

/**
 * Create a new debt
 */
export async function createDebt(data: {
  name: string;
  loanType: string;
  initialAmount: number;
  downPayment?: number;
  interestRate: number;
  totalMonths: number;
  firstPaymentDate: Date | string;
  startDate?: Date | string;
  monthlyPayment: number;
  paymentFrequency?: string;
  paymentAmount?: number;
  additionalContributions?: boolean;
  additionalContributionAmount?: number;
  priority?: "High" | "Medium" | "Low";
  description?: string;
  accountId?: string;
  isPaused?: boolean;
}): Promise<Debt> {
    const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const downPayment = data.downPayment ?? 0;
  const principalPaid = 0;
  const interestPaid = 0;
  const initialBalance = data.initialAmount - downPayment;
  const isPaidOff = initialBalance <= 0;

  const id = crypto.randomUUID();
  const now = formatTimestamp(new Date());

  const debtData: Record<string, unknown> = {
    id,
    name: data.name,
    loanType: data.loanType,
    initialAmount: data.initialAmount,
    downPayment,
    currentBalance: initialBalance,
    interestRate: data.interestRate,
    totalMonths: data.totalMonths,
    firstPaymentDate: formatDateOnly(new Date(data.firstPaymentDate)),
    startDate: data.startDate ? formatDateOnly(new Date(data.startDate)) : formatDateOnly(new Date(data.firstPaymentDate)),
    monthlyPayment: data.monthlyPayment,
    paymentFrequency: data.paymentFrequency ?? "monthly",
    paymentAmount: data.paymentAmount ?? null,
    principalPaid,
    interestPaid,
    additionalContributions: data.additionalContributions ?? false,
    additionalContributionAmount: data.additionalContributionAmount ?? 0,
    priority: data.priority ?? "Medium",
    description: data.description ?? null,
    accountId: data.accountId || null,
    userId: user.id,
    isPaidOff,
    isPaused: data.isPaused ?? false,
    paidOffAt: isPaidOff ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  const { data: debt, error } = await supabase
    .from("Debt")
    .insert(debtData)
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating debt:", error);
    throw new Error(`Failed to create debt: ${error.message || JSON.stringify(error)}`);
  }

  // Create all payment transactions for this debt
  if (debt.accountId && !isPaidOff) {
    try {
      await createDebtPaymentTransactions(debt);
    } catch (transactionError) {
      // Log error but don't fail debt creation
      console.error("Error creating debt payment transactions:", transactionError);
    }
  }

  return debt;
}

/**
 * Update an existing debt
 */
export async function updateDebt(
  id: string,
  data: {
    name?: string;
    loanType?: string;
    initialAmount?: number;
    downPayment?: number;
    currentBalance?: number;
    interestRate?: number;
    totalMonths?: number;
    firstPaymentDate?: Date | string;
    startDate?: Date | string;
    monthlyPayment?: number;
    paymentFrequency?: string;
    paymentAmount?: number;
    principalPaid?: number;
    interestPaid?: number;
    additionalContributions?: boolean;
    additionalContributionAmount?: number;
    priority?: "High" | "Medium" | "Low";
    description?: string;
    accountId?: string;
    isPaused?: boolean;
  }
): Promise<Debt> {
    const supabase = await createServerClient();

  // Verify ownership before updating
  await requireDebtOwnership(id);

  // Get current debt
  const { data: currentDebt, error: fetchError } = await supabase
    .from("Debt")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !currentDebt) {
    throw new Error("Debt not found");
  }

  // Use provided values or keep existing ones
  const initialAmount = data.initialAmount ?? currentDebt.initialAmount;
  const downPayment = data.downPayment ?? currentDebt.downPayment;
  const principalPaid = data.principalPaid ?? currentDebt.principalPaid;
  const effectiveCurrentBalance = data.currentBalance !== undefined
    ? data.currentBalance
    : currentDebt.currentBalance;

  // Check if debt should be marked as paid off
  const isPaidOff = effectiveCurrentBalance <= 0;

  const updateData: Record<string, unknown> = {
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
    // Use formatDateOnly to save only the date (00:00:00) in user's local timezone
    updateData.firstPaymentDate = formatDateOnly(new Date(data.firstPaymentDate));
  }
  if (data.startDate !== undefined) {
    // Use formatDateOnly to save only the date (00:00:00) in user's local timezone
    updateData.startDate = formatDateOnly(new Date(data.startDate));
  }
  if (data.monthlyPayment !== undefined) updateData.monthlyPayment = data.monthlyPayment;
  if (data.paymentFrequency !== undefined) updateData.paymentFrequency = data.paymentFrequency;
  if (data.paymentAmount !== undefined) updateData.paymentAmount = data.paymentAmount ?? null;
  if (data.principalPaid !== undefined) updateData.principalPaid = data.principalPaid;
  if (data.interestPaid !== undefined) updateData.interestPaid = data.interestPaid;
  if (data.additionalContributions !== undefined) {
    updateData.additionalContributions = data.additionalContributions;
  }
  if (data.additionalContributionAmount !== undefined) {
    updateData.additionalContributionAmount = data.additionalContributionAmount ?? 0;
  }
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
/**
 * Create all payment transactions for a debt
 * Creates transactions for all months from first payment date to totalMonths
 */
async function createDebtPaymentTransactions(debt: any): Promise<void> {
  if (!debt.accountId || debt.isPaidOff || debt.isPaused) {
    return;
  }

  // Get category mapping for the debt
  const categoryMapping = await getDebtCategoryMapping(debt.loanType);
  if (!categoryMapping) {
    console.warn(`Could not find category mapping for loan type: ${debt.loanType}`);
    return;
  }

  const firstPaymentDate = new Date(debt.firstPaymentDate);
  const paymentAmount = debt.paymentAmount || debt.monthlyPayment;
  const totalMonths = debt.totalMonths || 0;

  if (totalMonths <= 0 || paymentAmount <= 0) {
    return;
  }

  // Calculate payment frequency multiplier
  const paymentFrequency = debt.paymentFrequency || "monthly";
  let monthsBetweenPayments = 1;
  if (paymentFrequency === "biweekly") {
    monthsBetweenPayments = 14 / 30; // Approximately 0.467 months
  } else if (paymentFrequency === "weekly") {
    monthsBetweenPayments = 7 / 30; // Approximately 0.233 months
  } else if (paymentFrequency === "semimonthly") {
    monthsBetweenPayments = 0.5; // Twice per month
  } else if (paymentFrequency === "daily") {
    monthsBetweenPayments = 1 / 30; // Approximately 0.033 months
  }

  // Calculate number of payments based on frequency
  let numberOfPayments = totalMonths;
  if (paymentFrequency === "biweekly") {
    numberOfPayments = Math.ceil(totalMonths * (26 / 12)); // 26 payments per year
  } else if (paymentFrequency === "weekly") {
    numberOfPayments = Math.ceil(totalMonths * (52 / 12)); // 52 payments per year
  } else if (paymentFrequency === "semimonthly") {
    numberOfPayments = totalMonths * 2; // 24 payments per year
  } else if (paymentFrequency === "daily") {
    numberOfPayments = Math.ceil(totalMonths * 30); // Approximately 30 payments per month
  }

  // Limit to reasonable number of transactions (max 500)
  numberOfPayments = Math.min(numberOfPayments, 500);

  const transactions = [];
  let currentDate = new Date(firstPaymentDate);
  currentDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < numberOfPayments; i++) {
    // Calculate next payment date based on frequency
    if (paymentFrequency === "monthly") {
      currentDate = addMonths(new Date(firstPaymentDate), i);
    } else if (paymentFrequency === "biweekly") {
      currentDate = new Date(firstPaymentDate);
      currentDate.setDate(currentDate.getDate() + (i * 14));
    } else if (paymentFrequency === "weekly") {
      currentDate = new Date(firstPaymentDate);
      currentDate.setDate(currentDate.getDate() + (i * 7));
    } else if (paymentFrequency === "semimonthly") {
      currentDate = addMonths(new Date(firstPaymentDate), Math.floor(i / 2));
      if (i % 2 === 1) {
        currentDate.setDate(15); // Second payment of the month
      } else {
        currentDate.setDate(1); // First payment of the month
      }
    } else if (paymentFrequency === "daily") {
      currentDate = new Date(firstPaymentDate);
      currentDate.setDate(currentDate.getDate() + i);
    }

    transactions.push({
      date: currentDate,
      type: "expense" as const,
      amount: paymentAmount,
      accountId: debt.accountId,
      categoryId: categoryMapping.categoryId,
      subcategoryId: categoryMapping.subcategoryId,
      description: debt.name, // Use the debt name as provided by the user
      recurring: true, // Mark as recurring so it appears in upcoming transactions
    });
  }

  // Create transactions in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    await Promise.all(
      batch.map((tx) =>
        createTransaction(tx).catch((error) => {
          console.error(`Error creating transaction for debt ${debt.id} on ${tx.date}:`, error);
        })
      )
    );
  }

  console.log(`Created ${transactions.length} payment transactions for debt ${debt.id}`);
}

export async function deleteDebt(id: string): Promise<void> {
    const supabase = await createServerClient();

  // Verify ownership before deleting
  await requireDebtOwnership(id);

  const { error } = await supabase.from("Debt").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting debt:", error);
    throw new Error(`Failed to delete debt: ${error.message || JSON.stringify(error)}`);
  }
}

/**
 * Add a payment to a debt
 * Calculates principal and interest distribution automatically
 */
export async function addPayment(id: string, paymentAmount: number): Promise<Debt> {
  if (paymentAmount <= 0) {
    throw new Error("Payment amount must be positive");
  }

    const supabase = await createServerClient();

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

  // Calculate principal and interest distribution
  const monthlyInterestRate = getMonthlyInterestRate(debt.interestRate);
  const { principal, interest } = calculatePaymentDistribution(
    paymentAmount,
    debt.currentBalance,
    monthlyInterestRate
  );

  // Update debt
  const newPrincipalPaid = debt.principalPaid + principal;
  const newInterestPaid = debt.interestPaid + interest;
  const newBalance = Math.max(0, debt.currentBalance - principal);
  const isPaidOff = newBalance <= 0;

  const updateData: Record<string, unknown> = {
    currentBalance: newBalance,
    principalPaid: newPrincipalPaid,
    interestPaid: newInterestPaid,
    isPaidOff,
    updatedAt: formatTimestamp(new Date()),
  };

  if (isPaidOff && !debt.paidOffAt) {
    updateData.paidOffAt = formatTimestamp(new Date());
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

  // Create transaction automatically if accountId is set
  if (updatedDebt.accountId) {
    try {
      const categoryMapping = await getDebtCategoryMapping(debt.loanType);
      
      if (categoryMapping) {
        await createTransaction({
          date: new Date(),
          type: "expense",
          amount: paymentAmount,
          accountId: updatedDebt.accountId,
          categoryId: categoryMapping.categoryId,
          subcategoryId: categoryMapping.subcategoryId,
          description: `Payment for ${debt.name}`,
          recurring: false,
        });
      } else {
        console.warn(`Could not find category mapping for loan type: ${debt.loanType}`);
      }
    } catch (transactionError) {
      // Log error but don't fail the payment
      console.error("Error creating transaction for debt payment:", transactionError);
    }
  }

  return updatedDebt;
}

