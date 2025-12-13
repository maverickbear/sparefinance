/**
 * Onboarding Decision Service
 * Single source of truth for determining if onboarding dialog should be shown
 * All business logic for this decision is centralized here
 * 
 * NEW APPROACH: Uses explicit flag in household settings instead of subscription status
 * This avoids cache/timing issues and makes the logic deterministic
 */

import { makeOnboardingService } from "./onboarding.factory";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { logger } from "@/src/infrastructure/utils/logger";

const log = logger.withPrefix("OnboardingDecisionService");

export class OnboardingDecisionService {
  /**
   * Determines if onboarding dialog should be shown to the user
   * This is the single source of truth for this decision
   * 
   * NEW RULES (simplified, no subscription dependency):
   * - If household settings has onboardingCompletedAt → don't show (completed)
   * - If household has onboarding data (goals + householdType) but no flag → mark as complete and don't show
   * - Otherwise → show onboarding
   * 
   * @param userId - User ID to check
   * @param accessToken - Optional access token for authenticated requests
   * @param refreshToken - Optional refresh token for authenticated requests
   * @returns Promise<boolean> - true if dialog should be shown, false otherwise
   */
  async shouldShowOnboardingDialog(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<boolean> {
    try {
      const onboardingService = makeOnboardingService();
      
      // 1. Get active household
      const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
      
      if (!householdId) {
        // No household means user is brand new - show onboarding
        log.debug("No household found - showing onboarding", { userId });
        return true;
      }

      // 2. Check household settings for explicit completion flag
      const { HouseholdRepository } = await import("@/src/infrastructure/database/repositories/household.repository");
      const householdRepository = new HouseholdRepository();
      const settings = await householdRepository.getSettings(householdId, accessToken, refreshToken);

      if (settings?.onboardingCompletedAt) {
        // Onboarding already marked as complete
        log.debug("Onboarding already completed", {
          userId,
          householdId,
          completedAt: settings.onboardingCompletedAt,
        });
        return false;
      }

      // 3. Check if user has onboarding data but flag is missing (migration/edge case)
      const hasOnboardingData = await onboardingService.checkHasOnboardingData(
        userId,
        householdId,
        accessToken,
        refreshToken
      );

      if (hasOnboardingData) {
        // User has completed onboarding data but flag is missing - mark as complete
        log.debug("Found onboarding data without flag - marking as complete", {
          userId,
          householdId,
        });
        await onboardingService.markOnboardingComplete(userId, householdId, accessToken, refreshToken);
        return false;
      }

      // 4. No completion flag and no onboarding data - show onboarding
      log.debug("Onboarding not completed - showing dialog", {
        userId,
        householdId,
        hasOnboardingData,
      });
      return true;
    } catch (error) {
      log.error("Error determining if onboarding should be shown", error);
      // On error, default to showing onboarding (safer for user experience)
      return true;
    }
  }
}

