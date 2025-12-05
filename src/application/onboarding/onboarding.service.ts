/**
 * Onboarding Service
 * Business logic for onboarding feature
 */

import { HouseholdRepository } from "@/src/infrastructure/database/repositories/household.repository";
import { OnboardingMapper } from "./onboarding.mapper";
import { ExpectedIncomeRange, OnboardingStatusExtended } from "../../domain/onboarding/onboarding.types";
import { expectedIncomeRangeSchema } from "../../domain/onboarding/onboarding.validations";
import { locationSchema } from "../../domain/taxes/taxes.validations";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { logger } from "@/src/infrastructure/utils/logger";
import { BudgetGenerator } from "./budget-generator";
import { CategoryHelper } from "./category-helper";
import { FinancialHealthData } from "../shared/financial-health";
import { makeAccountsService } from "../accounts/accounts.factory";
import { makeProfileService } from "../profile/profile.factory";
import { makeSubscriptionsService } from "../subscriptions/subscriptions.factory";
import { AppError } from "../shared/app-error";

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
   * Get complete onboarding status including accounts, profile, and income
   */
  async getOnboardingStatus(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<OnboardingStatusExtended> {
    try {
      // Check accounts
      const accountsService = makeAccountsService();
      const accounts = await accountsService.getAccounts(accessToken, refreshToken, { includeHoldings: false });
      const hasAccount = accounts.length > 0;
      const totalBalance = hasAccount
        ? accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
        : undefined;

      // Check profile
      const profileService = makeProfileService();
      const profile = await profileService.getProfile(accessToken, refreshToken);
      const hasCompleteProfile = profile !== null && profile.name !== null && profile.name.trim() !== "";
      
      // Check personal data (phone and dateOfBirth) - required for onboarding
      const hasPersonalData = profile !== null && 
        profile.phoneNumber !== null && 
        profile.phoneNumber !== undefined && 
        profile.phoneNumber.trim() !== "" &&
        profile.dateOfBirth !== null && 
        profile.dateOfBirth !== undefined && 
        profile.dateOfBirth.trim() !== "";

      // Check income onboarding status
      const hasExpectedIncome = await this.checkIncomeOnboardingStatus(userId, accessToken, refreshToken);

      // Check if user has selected a plan (has active subscription or trial)
      // Note: cancelled subscriptions don't count as "hasPlan" for onboarding purposes
      // Users with cancelled subscriptions should see pricing dialog, not onboarding
      const subscriptionsService = makeSubscriptionsService();
      // Invalidate cache before checking to ensure we get the latest subscription status
      // This is critical when subscription was just created to avoid stale cache
      subscriptionsService.invalidateSubscriptionCache(userId);
      const subscriptionData = await subscriptionsService.getUserSubscriptionData(userId);
      const hasPlan = subscriptionData.plan !== null && 
                     subscriptionData.subscription !== null &&
                     (subscriptionData.subscription.status === "active" || 
                      subscriptionData.subscription.status === "trialing");

      // Calculate counts - new onboarding: personal data, income, plan (3 steps)
      const completedCount = [hasPersonalData, hasExpectedIncome, hasPlan].filter(Boolean).length;
      const totalCount = 3;

      return {
        hasAccount,
        hasCompleteProfile,
        hasPersonalData,
        hasExpectedIncome,
        hasPlan,
        completedCount,
        totalCount,
        totalBalance,
      };
    } catch (error) {
      logger.error("[OnboardingService] Error getting onboarding status:", error);
      // Return default status on error
      return {
        hasAccount: false,
        hasCompleteProfile: false,
        hasPersonalData: false,
        hasExpectedIncome: false,
        hasPlan: false,
        completedCount: 0,
        totalCount: 3,
      };
    }
  }

  /**
   * Check if user has completed income onboarding
   * Checks household settings first, then falls back to temporary income in profile
   */
  async checkIncomeOnboardingStatus(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<boolean> {
    try {
      const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
      
      // If household exists, check household settings
      if (householdId) {
        const settings = await this.householdRepository.getSettings(
          householdId,
          accessToken,
          refreshToken
        );

        if (settings?.expectedIncome !== undefined && settings.expectedIncome !== null) {
          return true;
        }
      }

      // Fallback to temporary income in profile
      const profileService = makeProfileService();
      const profile = await profileService.getProfile(accessToken, refreshToken);
      
      return profile?.temporaryExpectedIncome !== undefined && profile.temporaryExpectedIncome !== null;
    } catch (error) {
      logger.error("[OnboardingService] Error checking income onboarding status:", error);
      return false;
    }
  }

  /**
   * Save expected income to household settings
   * If no household exists, stores temporarily in User profile until household is created
   */
  async saveExpectedIncome(
    userId: string,
    incomeRange: ExpectedIncomeRange,
    accessToken?: string,
    refreshToken?: string,
    incomeAmount?: number | null
  ): Promise<void> {
    // Validate input
    expectedIncomeRangeSchema.parse(incomeRange);
    
    // Validate incomeAmount if provided
    if (incomeAmount !== undefined && incomeAmount !== null) {
      if (incomeAmount <= 0) {
        throw new AppError("Expected income amount must be positive", 400);
      }
    }

    const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
    
    // If no household exists, store temporarily in User profile
    if (!householdId) {
      logger.info(`[OnboardingService] No household found for user ${userId}, storing income temporarily in profile`);
      
      const profileService = makeProfileService();
      await profileService.updateProfile({ 
        temporaryExpectedIncome: incomeRange,
        temporaryExpectedIncomeAmount: incomeAmount ?? null,
      });
      
      logger.info(`[OnboardingService] Stored temporary expected income for user ${userId}: ${incomeRange}${incomeAmount ? ` (amount: $${incomeAmount})` : ''}`);
      return;
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
      expectedIncomeAmount: incomeAmount ?? null,
    });

    await this.householdRepository.updateSettings(
      householdId,
      updatedSettings,
      accessToken,
      refreshToken
    );

    logger.info(`[OnboardingService] Saved expected income for user ${userId}: ${incomeRange}${incomeAmount ? ` (amount: $${incomeAmount})` : ''}`);
  }

  /**
   * Save location (country and state/province) to household settings
   * If no household exists, this will fail (location must be saved to household)
   */
  async saveLocation(
    userId: string,
    country: string,
    stateOrProvince: string | null,
    accessToken?: string,
    refreshToken?: string
  ): Promise<void> {
    // Validate input
    locationSchema.parse({ country, stateOrProvince });

    const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
    
    if (!householdId) {
      throw new AppError("Household must exist to save location", 400);
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
      country,
      stateOrProvince,
    });

    await this.householdRepository.updateSettings(
      householdId,
      updatedSettings,
      accessToken,
      refreshToken
    );

    logger.info(`[OnboardingService] Saved location for user ${userId}: ${country}${stateOrProvince ? `, ${stateOrProvince}` : ''}`);
  }

  /**
   * Get location from household settings
   */
  async getLocation(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<{ country: string | null; stateOrProvince: string | null }> {
    const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
    
    if (!householdId) {
      return { country: null, stateOrProvince: null };
    }

    const settings = await this.householdRepository.getSettings(
      householdId,
      accessToken,
      refreshToken
    );

    return {
      country: settings?.country ?? null,
      stateOrProvince: settings?.stateOrProvince ?? null,
    };
  }

  /**
   * Get expected income from household settings or temporary profile storage
   */
  async getExpectedIncome(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<ExpectedIncomeRange> {
    const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
    
    // If household exists, check household settings first
    if (householdId) {
      const settings = await this.householdRepository.getSettings(
        householdId,
        accessToken,
        refreshToken
      );

      if (settings?.expectedIncome !== undefined && settings.expectedIncome !== null) {
        return settings.expectedIncome;
      }
    }

    // Fallback to temporary income in profile
    const profileService = makeProfileService();
    const profile = await profileService.getProfile(accessToken, refreshToken);
    
    return profile?.temporaryExpectedIncome ?? null;
  }

  /**
   * Get expected income with amount (range and custom amount if available)
   */
  async getExpectedIncomeWithAmount(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<{ incomeRange: ExpectedIncomeRange; incomeAmount?: number | null }> {
    const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
    
    // If household exists, check household settings first
    if (householdId) {
      const settings = await this.householdRepository.getSettings(
        householdId,
        accessToken,
        refreshToken
      );

      if (settings?.expectedIncome !== undefined && settings.expectedIncome !== null) {
        return {
          incomeRange: settings.expectedIncome,
          incomeAmount: settings.expectedIncomeAmount ?? null,
        };
      }
    }

    // Fallback to temporary income in profile
    const profileService = makeProfileService();
    const profile = await profileService.getProfile(accessToken, refreshToken);
    
    return {
      incomeRange: profile?.temporaryExpectedIncome ?? null,
      incomeAmount: profile?.temporaryExpectedIncomeAmount ?? null,
    };
  }

  /**
   * Get monthly income from expected income range or custom amount
   * If incomeAmount is provided, uses that value directly (converted to monthly)
   * Otherwise, uses the range midpoint
   */
  getMonthlyIncomeFromRange(incomeRange: ExpectedIncomeRange, incomeAmount?: number | null): number {
    // If custom amount is provided, use it directly
    if (incomeAmount !== undefined && incomeAmount !== null && incomeAmount > 0) {
      return incomeAmount / 12;
    }

    // Otherwise, use range midpoint
    if (!incomeRange) {
      return 0;
    }

    return INCOME_RANGE_TO_MONTHLY[incomeRange] || 0;
  }

  /**
   * Generate initial budgets based on expected income and optional budget rule
   */
  async generateInitialBudgets(
    userId: string,
    incomeRange: ExpectedIncomeRange,
    accessToken?: string,
    refreshToken?: string,
    ruleType?: import("../../domain/budgets/budget-rules.types").BudgetRuleType,
    incomeAmount?: number | null
  ): Promise<void> {
    if (!incomeRange) {
      throw new AppError("Income range is required to generate budgets", 400);
    }

    const monthlyIncome = this.getMonthlyIncomeFromRange(incomeRange, incomeAmount);
    if (monthlyIncome === 0) {
      throw new AppError("Invalid income range", 400);
    }

    // Get location if available
    const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
    let country: string | null = null;
    let stateOrProvince: string | null = null;
    
    if (householdId) {
      const settings = await this.householdRepository.getSettings(
        householdId,
        accessToken,
        refreshToken
      );
      country = settings?.country ?? null;
      stateOrProvince = settings?.stateOrProvince ?? null;
    }

    await this.budgetGenerator.generateInitialBudgets(
      userId,
      monthlyIncome,
      accessToken,
      refreshToken,
      ruleType,
      country,
      stateOrProvince
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

