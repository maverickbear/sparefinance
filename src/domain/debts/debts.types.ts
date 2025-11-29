/**
 * Domain types for debts
 * Pure TypeScript types with no external dependencies
 */

export interface BaseDebt {
  id: string;
  name: string;
  loanType: "mortgage" | "car_loan" | "personal_loan" | "credit_card" | "student_loan" | "business_loan" | "other";
  initialAmount: number;
  downPayment: number;
  currentBalance: number;
  interestRate: number;
  totalMonths: number | null;
  firstPaymentDate: string;
  monthlyPayment: number;
  paymentFrequency: "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily";
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

export interface DebtWithCalculations extends BaseDebt {
  remainingBalance: number;
  remainingPrincipal: number;
  monthsRemaining: number | null;
  totalInterestPaid: number;
  totalInterestRemaining: number;
  progressPct: number;
}

// Alias for backward compatibility (matches lib/api/debts.ts interface)
// Note: DebtWithCalculations is already defined above, this is just for reference

