"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import {
  calculateDebtMetrics,
  calculatePaymentDistribution,
  calculatePaymentsFromDate,
  getMonthlyInterestRate,
  type DebtForCalculation,
} from "@/lib/utils/debts";
import { createTransaction } from "@/lib/api/transactions";
import { createPlannedPayment, PLANNED_HORIZON_DAYS } from "@/lib/api/planned-payments";
import { getDebtCategoryMapping } from "@/lib/utils/debt-categories";
import { requireDebtOwnership } from "@/src/infrastructure/utils/security";
import { addMonths } from "date-fns";

export interface Debt {
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
  status?: string;
  nextDueDate?: string | null;
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
export async function getDebts(accessToken?: string, refreshToken?: string): Promise<DebtWithCalculations[]> {
  const supabase = await createServerClient(accessToken, refreshToken);

  // Verify user is authenticated (required for RLS policies)
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn("getDebts: User not authenticated");
    return [];
  }

  // OPTIMIZED: Select only necessary fields instead of * to reduce payload size
  const { data: debts, error } = await supabase
    .from("Debt")
    .select("id, name, loanType, initialAmount, downPayment, currentBalance, interestRate, totalMonths, firstPaymentDate, monthlyPayment, paymentFrequency, paymentAmount, principalPaid, interestPaid, additionalContributions, additionalContributionAmount, priority, description, accountId, isPaidOff, isPaused, paidOffAt, status, nextDueDate, createdAt, updatedAt, userId, householdId")
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
  totalMonths: number | null;
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
  status?: string;
  nextDueDate?: Date | string | null;
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

  // Get active household ID
  const { getActiveHouseholdId } = await import("@/lib/utils/household");
  const householdId = await getActiveHouseholdId(user.id);
  if (!householdId) {
    throw new Error("No active household found. Please contact support.");
  }

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
    householdId: householdId, // Add householdId for household-based architecture
    isPaidOff,
    isPaused: data.isPaused ?? false,
    paidOffAt: isPaidOff ? now : null,
    status: data.status ?? "active",
    nextDueDate: data.nextDueDate ? formatDateOnly(new Date(data.nextDueDate)) : null,
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

  // Create all planned payments for this debt (skip for credit cards - they're paid via transfers)
  if (debt.accountId && !isPaidOff && debt.loanType !== "credit_card") {
    try {
      await createDebtPlannedPayments(debt);
    } catch (error) {
      // Log error but don't fail debt creation
      console.error("Error creating debt planned payments:", error);
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

  // If debt payment details changed, update planned payments
  // Check if any relevant fields changed
  const paymentFieldsChanged = 
    data.firstPaymentDate !== undefined ||
    data.paymentFrequency !== undefined ||
    data.paymentAmount !== undefined ||
    data.monthlyPayment !== undefined ||
    data.accountId !== undefined ||
    data.isPaused !== undefined ||
    isPaidOff !== currentDebt.isPaidOff;

  if (paymentFieldsChanged && debt.accountId && !isPaidOff && !debt.isPaused && debt.loanType !== "credit_card") {
    try {
      // Delete existing scheduled planned payments for this debt
      const { error: deleteError } = await supabase
        .from("PlannedPayment")
        .delete()
        .eq("debtId", id)
        .eq("status", "scheduled");

      if (deleteError) {
        console.error("Error deleting old planned payments:", deleteError);
        // Continue anyway - we'll create new ones
      }

      // Create new planned payments with updated data
      await createDebtPlannedPayments(debt);
    } catch (error) {
      // Log error but don't fail debt update
      console.error("Error updating debt planned payments:", error);
    }
  } else if (isPaidOff || debt.isPaused) {
    // If debt is paid off or paused, delete all scheduled planned payments
    try {
      const { error: deleteError } = await supabase
        .from("PlannedPayment")
        .delete()
        .eq("debtId", id)
        .eq("status", "scheduled");

      if (deleteError) {
        console.error("Error deleting planned payments for paid/paused debt:", deleteError);
      }
    } catch (error) {
      console.error("Error cleaning up planned payments:", error);
    }
  }

  return debt;
}

/**
 * Delete a debt
 */
/**
 * Create all planned payments for a debt
 * Creates PlannedPayments only for future dates starting from today
 * Only creates PlannedPayments up to PLANNED_HORIZON_DAYS (90 days)
 * Past payments are NOT created to avoid cluttering the system.
 * PlannedPayments will appear in Upcoming Transactions and can be marked as paid by the user.
 */
async function createDebtPlannedPayments(debt: any): Promise<void> {
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

  // Calculate payment frequency
  const paymentFrequency = debt.paymentFrequency || "monthly";

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

  const plannedPayments = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate horizon date (PLANNED_HORIZON_DAYS from today)
  const horizonDate = new Date(today);
  horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
  horizonDate.setHours(23, 59, 59, 999);

  // Find the first payment date that is on or after today
  let currentDate = new Date(firstPaymentDate);
  currentDate.setHours(0, 0, 0, 0);
  
  // If firstPaymentDate is in the past, calculate the next payment date
  if (currentDate < today) {
    // Calculate how many periods have passed since firstPaymentDate
    let periodsPassed = 0;
    if (paymentFrequency === "monthly") {
      periodsPassed = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    } else if (paymentFrequency === "biweekly") {
      periodsPassed = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 14));
    } else if (paymentFrequency === "weekly") {
      periodsPassed = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    } else if (paymentFrequency === "semimonthly") {
      periodsPassed = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 15));
    } else if (paymentFrequency === "daily") {
      periodsPassed = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    // Advance to the next payment date after today
    for (let i = 0; i <= periodsPassed; i++) {
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
          currentDate.setDate(15);
        } else {
          currentDate.setDate(1);
        }
      } else if (paymentFrequency === "daily") {
        currentDate = new Date(firstPaymentDate);
        currentDate.setDate(currentDate.getDate() + i);
      }
      currentDate.setHours(0, 0, 0, 0);
    }
    
    // Ensure we're at or after today
    while (currentDate < today) {
      if (paymentFrequency === "monthly") {
        currentDate = addMonths(currentDate, 1);
      } else if (paymentFrequency === "biweekly") {
        currentDate.setDate(currentDate.getDate() + 14);
      } else if (paymentFrequency === "weekly") {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (paymentFrequency === "semimonthly") {
        if (currentDate.getDate() <= 15) {
          currentDate.setDate(15);
        } else {
          currentDate = addMonths(currentDate, 1);
          currentDate.setDate(1);
        }
      } else if (paymentFrequency === "daily") {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      currentDate.setHours(0, 0, 0, 0);
    }
  }

  // Calculate the starting index based on how many payments have already passed
  let startingIndex = 0;
  if (paymentFrequency === "monthly") {
    startingIndex = Math.floor((currentDate.getTime() - firstPaymentDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  } else if (paymentFrequency === "biweekly") {
    startingIndex = Math.floor((currentDate.getTime() - firstPaymentDate.getTime()) / (1000 * 60 * 60 * 24 * 14));
  } else if (paymentFrequency === "weekly") {
    startingIndex = Math.floor((currentDate.getTime() - firstPaymentDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
  } else if (paymentFrequency === "semimonthly") {
    startingIndex = Math.floor((currentDate.getTime() - firstPaymentDate.getTime()) / (1000 * 60 * 60 * 24 * 15));
  } else if (paymentFrequency === "daily") {
    startingIndex = Math.floor((currentDate.getTime() - firstPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Only create transactions for future dates (on or after today)
  // These transactions will appear in Upcoming Transactions and can be marked as paid
  for (let i = startingIndex; i < numberOfPayments; i++) {
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
    
    currentDate.setHours(0, 0, 0, 0);

    // Only create planned payments for dates on or after today and within horizon
    if (currentDate >= today && currentDate <= horizonDate) {
      plannedPayments.push({
        date: currentDate,
        type: "expense" as const,
        amount: paymentAmount,
        accountId: debt.accountId,
        categoryId: categoryMapping.categoryId,
        subcategoryId: categoryMapping.subcategoryId,
        description: debt.name, // Use the debt name as provided by the user
        source: "debt" as const,
        debtId: debt.id,
      });
    }
    
    // Stop if we've exceeded the horizon
    if (currentDate > horizonDate) {
      break;
    }
  }

  // Only create planned payments if there are any future payments to create
  if (plannedPayments.length === 0) {
    console.log(`No future planned payments to create for debt ${debt.id} (all payments are in the past or beyond horizon)`);
    return;
  }

  // Create planned payments in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < plannedPayments.length; i += batchSize) {
    const batch = plannedPayments.slice(i, i + batchSize);
    await Promise.all(
      batch.map((pp) =>
        createPlannedPayment(pp).catch((error) => {
          console.error(`Error creating planned payment for debt ${debt.id} on ${pp.date}:`, error);
        })
      )
    );
  }

  console.log(`Created ${plannedPayments.length} planned payments for debt ${debt.id} (starting from ${today.toISOString().split('T')[0]}, up to ${PLANNED_HORIZON_DAYS} days)`);
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

  // Credit card debts are paid via transfers to the credit card account, not through addPayment
  if (debt.loanType === "credit_card") {
    console.log("Credit card debts are paid via transfers to the credit card account, not through addPayment()");
    return updatedDebt;
  }

  // Create transaction automatically if accountId is set (for non-credit-card debts)
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

