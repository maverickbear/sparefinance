/**
 * User Subscriptions Repository
 * Data access layer for UserServiceSubscription
 */

import { createServerClient } from "../supabase-server";
import { UserServiceSubscription } from "../../../domain/subscriptions/subscriptions.types";
import { logger } from "@/src/infrastructure/utils/logger";

export interface UserServiceSubscriptionRow {
  id: string;
  userId: string;
  householdId: string;
  serviceName: string;
  subcategoryId?: string | null;
  planId?: string | null;
  amount: number | string;
  description?: string | null;
  billingFrequency: string;
  billingDay?: number | null;
  accountId: string;
  isActive: boolean;
  firstBillingDate: string;
  createdAt: string;
  updatedAt: string;
}

export class UserSubscriptionsRepository {
  /**
   * Find all user subscriptions
   */
  async findAll(userId: string): Promise<UserServiceSubscriptionRow[]> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("UserServiceSubscription")
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) {
      logger.error("[UserSubscriptionsRepository] Error fetching subscriptions:", error);
      throw new Error(`Failed to fetch subscriptions: ${error.message}`);
    }

    return (data || []) as UserServiceSubscriptionRow[];
  }

  /**
   * Find subscription by ID
   */
  async findById(id: string): Promise<UserServiceSubscriptionRow | null> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("UserServiceSubscription")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      logger.error("[UserSubscriptionsRepository] Error fetching subscription:", error);
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }

    return data as UserServiceSubscriptionRow;
  }

  /**
   * Create subscription
   */
  async create(data: {
    id: string;
    userId: string;
    householdId: string;
    serviceName: string;
    subcategoryId?: string | null;
    planId?: string | null;
    amount: number;
    description?: string | null;
    billingFrequency: string;
    billingDay?: number | null;
    accountId: string;
    isActive: boolean;
    firstBillingDate: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<UserServiceSubscriptionRow> {
    const supabase = await createServerClient();

    const { data: subscription, error } = await supabase
      .from("UserServiceSubscription")
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error("[UserSubscriptionsRepository] Error creating subscription:", error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    return subscription as UserServiceSubscriptionRow;
  }

  /**
   * Update subscription
   */
  async update(id: string, data: Partial<UserServiceSubscriptionRow>): Promise<UserServiceSubscriptionRow> {
    const supabase = await createServerClient();

    const { data: subscription, error } = await supabase
      .from("UserServiceSubscription")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[UserSubscriptionsRepository] Error updating subscription:", error);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }

    return subscription as UserServiceSubscriptionRow;
  }

  /**
   * Delete subscription
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("UserServiceSubscription")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[UserSubscriptionsRepository] Error deleting subscription:", error);
      throw new Error(`Failed to delete subscription: ${error.message}`);
    }
  }
}

