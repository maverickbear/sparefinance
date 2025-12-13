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
      userId: row.user_id,
      householdId: row.household_id,
      planId: row.plan_id,
      status: row.status,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeCustomerId: row.stripe_customer_id,
      currentPeriodStart: row.current_period_start ? new Date(row.current_period_start) : null,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
      trialEndDate: row.trial_end_date ? new Date(row.trial_end_date) : null,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
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
      priceMonthly: row.price_monthly,
      priceYearly: row.price_yearly,
      features,
      stripePriceIdMonthly: row.stripe_price_id_monthly,
      stripePriceIdYearly: row.stripe_price_id_yearly,
      stripeProductId: row.stripe_product_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

