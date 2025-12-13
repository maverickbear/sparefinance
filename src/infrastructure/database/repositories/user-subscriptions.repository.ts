/**
 * User Subscriptions Repository
 * 
 * ⚠️ IMPORTANT: This repository handles EXTERNAL service subscriptions (Netflix, Spotify, etc.)
 * NOT Spare Finance app subscriptions. For app subscriptions, see SubscriptionsRepository.
 * 
 * Data access layer for UserServiceSubscription (external services only)
 */

import { createServerClient } from "../supabase-server";
import { UserServiceSubscription } from "../../../domain/subscriptions/subscriptions.types";
import { logger } from "@/src/infrastructure/utils/logger";

export interface UserServiceSubscriptionRow {
  id: string;
  user_id: string;
  household_id: string;
  service_name: string;
  subcategory_id?: string | null;
  plan_id?: string | null;
  amount: number | string;
  description?: string | null;
  billing_frequency: string;
  billing_day?: number | null;
  account_id: string;
  is_active: boolean;
  first_billing_date: string;
  created_at: string;
  updated_at: string;
}

export class UserSubscriptionsRepository {
  /**
   * Find all user subscriptions
   */
  async findAll(userId: string, householdId?: string): Promise<UserServiceSubscriptionRow[]> {
    const supabase = await createServerClient();

    let query = supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId);

    // If householdId is provided, also filter by it (for RLS policies)
    if (householdId) {
      query = query.eq("household_id", householdId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      // Handle permission denied errors gracefully (can happen during SSR)
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        logger.warn("[UserSubscriptionsRepository] Permission denied fetching subscriptions - user may not be authenticated");
        return [];
      }
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
      .from("user_subscriptions")
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

    const insertData: any = {
      id: data.id,
      user_id: data.userId,
      household_id: data.householdId,
      service_name: data.serviceName,
      subcategory_id: data.subcategoryId,
      plan_id: data.planId,
      amount: data.amount,
      description: data.description,
      billing_frequency: data.billingFrequency,
      billing_day: data.billingDay,
      account_id: data.accountId,
      is_active: data.isActive,
      first_billing_date: data.firstBillingDate,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    };

    const { data: subscription, error } = await supabase
      .from("user_subscriptions")
      .insert(insertData)
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
   * Receives camelCase parameters and maps to snake_case for database
   */
  async update(id: string, data: Partial<{
    serviceName: string;
    subcategoryId: string | null;
    planId: string | null;
    amount: number;
    description: string | null;
    billingFrequency: string;
    billingDay: number | null;
    accountId: string;
    isActive: boolean;
    firstBillingDate: string;
    updatedAt: string;
  }>): Promise<UserServiceSubscriptionRow> {
    const supabase = await createServerClient();

    // Map camelCase to snake_case for database
    const updateData: Record<string, unknown> = {};
    if (data.serviceName !== undefined) updateData.service_name = data.serviceName;
    if (data.subcategoryId !== undefined) updateData.subcategory_id = data.subcategoryId;
    if (data.planId !== undefined) updateData.plan_id = data.planId;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.billingFrequency !== undefined) updateData.billing_frequency = data.billingFrequency;
    if (data.billingDay !== undefined) updateData.billing_day = data.billingDay;
    if (data.accountId !== undefined) updateData.account_id = data.accountId;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.firstBillingDate !== undefined) updateData.first_billing_date = data.firstBillingDate;
    if (data.updatedAt !== undefined) updateData.updated_at = data.updatedAt;

    const { data: subscription, error } = await supabase
      .from("user_subscriptions")
      .update(updateData)
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
      .from("user_subscriptions")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[UserSubscriptionsRepository] Error deleting subscription:", error);
      throw new Error(`Failed to delete subscription: ${error.message}`);
    }
  }
}

