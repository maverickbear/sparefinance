/**
 * Subscriptions Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseSubscription, BasePlan, BasePlanFeatures } from "../../domain/subscriptions/subscriptions.types";
import { SubscriptionRow, PlanRow } from "@/src/infrastructure/database/repositories/subscriptions.repository";
import { normalizeAndValidateFeatures } from "@/src/application/shared/plan-features-service";

export class SubscriptionsMapper {
  /**
   * Map subscription row to domain entity
   */
  static subscriptionToDomain(row: SubscriptionRow): BaseSubscription {
    return {
      id: row.id,
      userId: row.userId,
      householdId: row.householdId,
      planId: row.planId,
      status: row.status,
      stripeSubscriptionId: row.stripeSubscriptionId,
      stripeCustomerId: row.stripeCustomerId,
      currentPeriodStart: row.currentPeriodStart ? new Date(row.currentPeriodStart) : null,
      currentPeriodEnd: row.currentPeriodEnd ? new Date(row.currentPeriodEnd) : null,
      trialEndDate: row.trialEndDate ? new Date(row.trialEndDate) : null,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  /**
   * Map plan row to domain entity
   */
  static planToDomain(row: PlanRow): BasePlan {
    // Use centralized service to normalize and validate features
    const features = normalizeAndValidateFeatures(row.features, row.id);

    return {
      id: row.id,
      name: row.name,
      priceMonthly: row.priceMonthly,
      priceYearly: row.priceYearly,
      features,
      stripePriceIdMonthly: row.stripePriceIdMonthly,
      stripePriceIdYearly: row.stripePriceIdYearly,
      stripeProductId: row.stripeProductId,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

