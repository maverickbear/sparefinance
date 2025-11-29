/**
 * Subscriptions Repository
 * Data access layer for subscriptions - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

export interface SubscriptionRow {
  id: string;
  userId: string | null;
  householdId: string | null;
  planId: string;
  status: "active" | "trialing" | "cancelled" | "past_due" | "unpaid";
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndDate: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanRow {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: any; // JSONB field
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  stripeProductId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class SubscriptionsRepository {
  /**
   * Find subscription by household ID
   */
  async findByHouseholdId(householdId: string): Promise<SubscriptionRow | null> {
    const supabase = await createServerClient();

    const { data: subscriptions, error } = await supabase
      .from("Subscription")
      .select("*")
      .eq("householdId", householdId)
      .in("status", ["active", "trialing", "cancelled"])
      .order("createdAt", { ascending: false })
      .limit(10);

    if (error) {
      logger.error("[SubscriptionsRepository] Error fetching subscription by householdId:", error);
      return null;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return null;
    }

    // Prioritize: active/trialing > cancelled, then by createdAt (newest first)
    const sorted = subscriptions.sort((a, b) => {
      const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
      const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted[0] as SubscriptionRow;
  }

  /**
   * Find subscription by user ID
   */
  async findByUserId(userId: string): Promise<SubscriptionRow | null> {
    const supabase = await createServerClient();

    const { data: subscriptions, error } = await supabase
      .from("Subscription")
      .select("*")
      .eq("userId", userId)
      .in("status", ["active", "trialing", "cancelled"])
      .order("createdAt", { ascending: false })
      .limit(10);

    if (error) {
      logger.error("[SubscriptionsRepository] Error fetching subscription by userId:", error);
      return null;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return null;
    }

    // Prioritize: active/trialing > cancelled, then by createdAt (newest first)
    const sorted = subscriptions.sort((a, b) => {
      const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
      const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted[0] as SubscriptionRow;
  }

  /**
   * Find all plans
   */
  async findAllPlans(): Promise<PlanRow[]> {
    const supabase = await createServerClient();

    const { data: plans, error } = await supabase
      .from("Plan")
      .select("*")
      .order("priceMonthly", { ascending: true });

    if (error) {
      logger.error("[SubscriptionsRepository] Error fetching plans:", error);
      return [];
    }

    return (plans || []) as PlanRow[];
  }

  /**
   * Find plan by ID
   */
  async findPlanById(planId: string): Promise<PlanRow | null> {
    const supabase = await createServerClient();

    const { data: plan, error } = await supabase
      .from("Plan")
      .select("*")
      .eq("id", planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[SubscriptionsRepository] Error fetching plan:", error);
      return null;
    }

    return plan as PlanRow;
  }

  /**
   * Get user subscription cache from User table
   */
  async getUserSubscriptionCache(userId: string): Promise<{
    effectivePlanId: string | null;
    effectiveSubscriptionStatus: string | null;
    effectiveSubscriptionId: string | null;
    subscriptionUpdatedAt: string | null;
  } | null> {
    const supabase = await createServerClient();

    const { data: user, error } = await supabase
      .from("User")
      .select("effectivePlanId, effectiveSubscriptionStatus, effectiveSubscriptionId, subscriptionUpdatedAt")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      logger.error("[SubscriptionsRepository] Error fetching user subscription cache:", error);
      return null;
    }

    return user || null;
  }

  /**
   * Get active household ID for user
   */
  async getActiveHouseholdId(userId: string): Promise<string | null> {
    const supabase = await createServerClient();

    const { data: activeHousehold } = await supabase
      .from("UserActiveHousehold")
      .select("householdId")
      .eq("userId", userId)
      .maybeSingle();

    if (activeHousehold?.householdId) {
      return activeHousehold.householdId;
    }

    // Fallback to default household
    const { data: defaultMember } = await supabase
      .from("HouseholdMemberNew")
      .select("householdId")
      .eq("userId", userId)
      .eq("isDefault", true)
      .eq("status", "active")
      .maybeSingle();

    return defaultMember?.householdId || null;
  }

  /**
   * Get household owner ID
   */
  async getHouseholdOwnerId(householdId: string): Promise<string | null> {
    const supabase = await createServerClient();

    const { data: household } = await supabase
      .from("Household")
      .select("createdBy")
      .eq("id", householdId)
      .maybeSingle();

    return household?.createdBy || null;
  }
}

