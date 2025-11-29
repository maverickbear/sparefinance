/**
 * Onboarding Service
 * Business logic for onboarding feature
 */

import { HouseholdRepository } from "@/src/infrastructure/database/repositories/household.repository";
import { OnboardingMapper } from "./onboarding.mapper";
import { ExpectedIncomeRange } from "../../domain/onboarding/onboarding.types";
import { expectedIncomeRangeSchema } from "../../domain/onboarding/onboarding.validations";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { logger } from "@/src/infrastructure/utils/logger";
import { BudgetGenerator } from "./budget-generator";
import { CategoryHelper } from "./category-helper";
import { FinancialHealthData } from "../shared/financial-health";

// Income range to monthly income conversion (using midpoint of range)
const INCOME_RANGE_TO_MONTHLY: Record<NonNullable<ExpectedIncomeRange>, number> = {
  "0-50k": 25000 / 12, // ~$2,083/month
  "50k-100k": 75000 / 12, // ~$6,250/month
  "100k-150k": 125000 / 12, // ~$10,417/month
  "150k-250k": 200000 / 12, // ~$16,667/month
  "250k+": 300000 / 12, // ~$25,000/month
};

export class OnboardingService {
  constructor(
    private householdRepository: HouseholdRepository,
    private budgetGenerator: BudgetGenerator,
    private categoryHelper: CategoryHelper
  ) {}

  /**
   * Check if user has completed income onboarding
   */
  async checkIncomeOnboardingStatus(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<boolean> {
    try {
      const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
      if (!householdId) {
        return false;
      }

      const settings = await this.householdRepository.getSettings(
        householdId,
        accessToken,
        refreshToken
      );

      return settings?.expectedIncome !== undefined && settings.expectedIncome !== null;
    } catch (error) {
      logger.error("[OnboardingService] Error checking income onboarding status:", error);
      return false;
    }
  }

  /**
   * Save expected income to household settings
   */
  async saveExpectedIncome(
    userId: string,
    incomeRange: ExpectedIncomeRange,
    accessToken?: string,
    refreshToken?: string
  ): Promise<void> {
    // Validate input
    expectedIncomeRangeSchema.parse(incomeRange);

    const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
    if (!householdId) {
      throw new Error("Active household not found");
    }

    // Get current settings
    const currentSettings = await this.householdRepository.getSettings(
      householdId,
      accessToken,
      refreshToken
    );

    // Update settings
    const updatedSettings = OnboardingMapper.settingsToDatabase({
      ...currentSettings,
      expectedIncome: incomeRange,
    });

    await this.householdRepository.updateSettings(
      householdId,
      updatedSettings,
      accessToken,
      refreshToken
    );

    logger.info(`[OnboardingService] Saved expected income for user ${userId}: ${incomeRange}`);
  }

  /**
   * Get expected income from household settings
   */
  async getExpectedIncome(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<ExpectedIncomeRange> {
    const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
    if (!householdId) {
      return null;
    }

    const settings = await this.householdRepository.getSettings(
      householdId,
      accessToken,
      refreshToken
    );

    return settings?.expectedIncome ?? null;
  }

  /**
   * Get monthly income from expected income range
   */
  getMonthlyIncomeFromRange(incomeRange: ExpectedIncomeRange): number {
    if (!incomeRange) {
      return 0;
    }

    return INCOME_RANGE_TO_MONTHLY[incomeRange] || 0;
  }

  /**
   * Generate initial budgets based on expected income
   */
  async generateInitialBudgets(
    userId: string,
    incomeRange: ExpectedIncomeRange,
    accessToken?: string,
    refreshToken?: string
  ): Promise<void> {
    if (!incomeRange) {
      throw new Error("Income range is required to generate budgets");
    }

    const monthlyIncome = this.getMonthlyIncomeFromRange(incomeRange);
    if (monthlyIncome === 0) {
      throw new Error("Invalid income range");
    }

    await this.budgetGenerator.generateInitialBudgets(
      userId,
      monthlyIncome,
      accessToken,
      refreshToken
    );

    logger.info(`[OnboardingService] Generated initial budgets for user ${userId}`);
  }

  /**
   * Calculate initial health score based on projected income
   */
  calculateInitialHealthScore(monthlyIncome: number): FinancialHealthData {
    // Projected expenses: 80% of income (standard rule)
    const monthlyExpenses = monthlyIncome * 0.8;
    const netAmount = monthlyIncome - monthlyExpenses;
    const savingsRate = (netAmount / monthlyIncome) * 100;
    const expenseRatio = (monthlyExpenses / monthlyIncome) * 100;

    // Calculate score based on expense ratio (same logic as financial-health.ts)
    let score: number;
    if (expenseRatio <= 60) {
      score = 100 - (expenseRatio / 60) * 9; // 100-91
    } else if (expenseRatio <= 70) {
      score = 90 - ((expenseRatio - 60) / 10) * 9; // 90-81
    } else if (expenseRatio <= 80) {
      score = 80 - ((expenseRatio - 70) / 10) * 9; // 80-71
    } else if (expenseRatio <= 90) {
      score = 70 - ((expenseRatio - 80) / 10) * 9; // 70-61
    } else {
      score = 60 - ((expenseRatio - 90) / 10) * 60; // 60-0
    }

    // Determine classification
    let classification: "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
    if (score >= 91) {
      classification = "Excellent";
    } else if (score >= 81) {
      classification = "Good";
    } else if (score >= 71) {
      classification = "Fair";
    } else if (score >= 61) {
      classification = "Poor";
    } else {
      classification = "Critical";
    }

    // Determine spending discipline
    let spendingDiscipline: "Excellent" | "Good" | "Fair" | "Poor" | "Critical" | "Unknown";
    if (expenseRatio <= 60) {
      spendingDiscipline = "Excellent";
    } else if (expenseRatio <= 70) {
      spendingDiscipline = "Good";
    } else if (expenseRatio <= 80) {
      spendingDiscipline = "Fair";
    } else if (expenseRatio <= 90) {
      spendingDiscipline = "Poor";
    } else {
      spendingDiscipline = "Critical";
    }

    // Calculate emergency fund months (assuming 6 months expenses target)
    const emergencyFundTarget = monthlyExpenses * 6;
    const emergencyFundMonths = 0; // No actual emergency fund yet

    return {
      score: Math.round(score),
      classification,
      monthlyIncome,
      monthlyExpenses,
      netAmount,
      savingsRate,
      message: "This is a projected score based on your expected income. Connect your bank account to see your actual Spare Score.",
      spendingDiscipline,
      debtExposure: "Low" as const,
      emergencyFundMonths,
      alerts: [
        {
          id: "projected_score",
          title: "Projected Score",
          description: "This score is based on your expected income. Connect your bank account to see your actual financial health.",
          severity: "info" as const,
          action: "Connect your bank account to get started.",
        },
      ],
      suggestions: [
        {
          id: "connect_account",
          title: "Connect Your Bank Account",
          description: "Connect your bank account to see your actual transactions and get personalized insights.",
          impact: "high" as const,
        },
      ],
    };
  }
}

