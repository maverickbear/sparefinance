/**
 * Pure Spare Score penalty and classification helpers (docs/Spare_Score.md).
 * No "use server" — safe to import from both server-action and non–server-action code.
 */
import type { DebtWithCalculations } from "../../domain/debts/debts.types";

/** Score bands: 85-100 Excellent, 70-84 Strong, 55-69 Fair, 40-54 Fragile, <40 Critical */
export type SpareScoreClassification = "Excellent" | "Strong" | "Fair" | "Fragile" | "Critical";

const DEBT_TYPE_MULTIPLIER: Record<string, number> = {
  mortgage: 0.6,
  student_loan: 0.8,
  car_loan: 1.0,
  personal_loan: 1.1,
  credit_card: 1.3,
  business_loan: 1.6,
  other: 1.6,
};

function getDebtTypeMultiplier(loanType: string): number {
  return DEBT_TYPE_MULTIPLIER[loanType] ?? 1.6;
}

/** Pillar 1: Cash Flow Health (max -30). */
export function penaltyCashFlow(monthlyIncome: number, monthlyExpenses: number, netAmount: number): number {
  if (monthlyIncome > 0) {
    const cashFlowRatioPct = (netAmount / monthlyIncome) * 100;
    if (cashFlowRatioPct > 10) return 0;
    if (cashFlowRatioPct > 0) return -5;
    if (cashFlowRatioPct === 0) return -10;
    if (cashFlowRatioPct >= -10) return -20;
    return -30;
  }
  if (monthlyExpenses > 0) return -30;
  return -10;
}

/** Pillar 2: Emergency Fund (max -20). */
export function penaltyEmergencyFund(emergencyFundMonths: number): number {
  if (emergencyFundMonths >= 6) return 0;
  if (emergencyFundMonths >= 4) return -5;
  if (emergencyFundMonths >= 2) return -10;
  if (emergencyFundMonths >= 1) return -15;
  return -20;
}

/** Pillar 3: Debt Health from MDLR % (max -20). */
export function penaltyDebtFromMDLR(mdlrPct: number): number {
  if (mdlrPct <= 0) return 0;
  if (mdlrPct < 15) return -2;
  if (mdlrPct <= 30) return -8;
  if (mdlrPct <= 45) return -14;
  return -20;
}

/** Pillar 4: Savings Behavior (max -15). */
export function penaltySavings(savingsRatePct: number): number {
  if (savingsRatePct >= 20) return 0;
  if (savingsRatePct >= 10) return -5;
  if (savingsRatePct >= 5) return -8;
  if (savingsRatePct >= 1) return -12;
  return -15;
}

/** Pillar 5: Stability (max -15). v1: 0 penalty. */
export function penaltyStability(_level?: "High" | "Medium" | "Low" | "Chaotic"): number {
  return 0;
}

export function getClassificationFromScore(score: number): SpareScoreClassification {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Fair";
  if (score >= 40) return "Fragile";
  return "Critical";
}

export function getMessageFromClassification(classification: SpareScoreClassification): string {
  switch (classification) {
    case "Excellent":
      return "You're living below your means — great job!";
    case "Strong":
    case "Fair":
      return "Your expenses are balanced but close to your limit.";
    case "Fragile":
    case "Critical":
      return "Warning: you're spending more than you earn!";
    default:
      return "";
  }
}

export function computeEffectiveMonthlyDebtPayment(debts: DebtWithCalculations[]): number {
  return debts
    .filter((d) => !d.isPaidOff)
    .reduce((sum, d) => {
      const payment = Math.abs(Number(d.monthlyPayment) || 0);
      const mult = getDebtTypeMultiplier(d.loanType);
      return sum + payment * mult;
    }, 0);
}
