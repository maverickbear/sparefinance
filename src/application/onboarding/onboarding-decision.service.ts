/**
 * Onboarding Decision Service
 * Single source of truth for determining if onboarding dialog should be shown
 * All business logic for this decision is centralized here
 */

import { getDashboardSubscription } from "../subscriptions/get-dashboard-subscription";
import { makeOnboardingService } from "./onboarding.factory";
import { logger } from "@/src/infrastructure/utils/logger";

const log = logger.withPrefix("OnboardingDecisionService");

export class OnboardingDecisionService {
  /**
   * Determines if onboarding dialog should be shown to the user
   * This is the single source of truth for this decision
   * 
   * Rules:
   * - If user has active or trialing subscription → don't show (completed onboarding)
   * - If user has cancelled subscription → don't show (completed onboarding, just cancelled)
   * - If user has no subscription and onboarding is incomplete → show
   * - If user has no subscription and onboarding is complete → don't show (edge case)
   * 
   * @param userId - User ID to check
   * @returns Promise<boolean> - true if dialog should be shown, false otherwise
   */
  async shouldShowOnboardingDialog(userId: string): Promise<boolean> {
    try {
      // Get subscription data (uses cached function)
      const subscriptionData = await getDashboardSubscription();
      
      const hasActivePlan = subscriptionData.plan !== null && 
                           subscriptionData.subscription !== null &&
                           (subscriptionData.subscription.status === "active" || 
                            subscriptionData.subscription.status === "trialing");
      
      const hasCancelledSubscription = subscriptionData.subscription !== null &&
                                       subscriptionData.subscription.status === "cancelled";
      
      // If user has any subscription (active or cancelled), they completed onboarding
      if (hasActivePlan || hasCancelledSubscription) {
        log.debug("User has subscription - onboarding complete", {
          userId,
          status: subscriptionData.subscription?.status,
          hasActivePlan,
          hasCancelledSubscription,
        });
        return false;
      }
      
      // User doesn't have subscription - check onboarding status
      const onboardingService = makeOnboardingService();
      const onboardingStatus = await onboardingService.getOnboardingStatus(
        userId,
        undefined,
        undefined,
        { skipSubscriptionCheck: true } // Already checked above
      );
      
      // Show dialog if onboarding is incomplete
      const shouldShow = onboardingStatus.completedCount < onboardingStatus.totalCount;
      
      log.debug("Onboarding decision", {
        userId,
        hasActivePlan,
        hasCancelledSubscription,
        completedCount: onboardingStatus.completedCount,
        totalCount: onboardingStatus.totalCount,
        shouldShow,
      });
      
      return shouldShow;
    } catch (error) {
      log.error("Error determining if onboarding should be shown", error);
      // On error, default to showing onboarding (safer for user experience)
      return true;
    }
  }
}

