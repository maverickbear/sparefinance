"use server";

import { createServerClient } from "@/lib/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/lib/utils/timestamp";
import { createPlannedPayment, PLANNED_HORIZON_DAYS } from "@/lib/api/planned-payments";
import { createSubcategory } from "@/lib/api/categories";
import { addMonths, addYears, addDays, startOfMonth, setDate } from "date-fns";
import { logger } from "@/lib/utils/logger";

export interface UserServiceSubscription {
  id: string;
  userId: string;
  serviceName: string;
  subcategoryId?: string | null;
  amount: number;
  description?: string | null;
  billingFrequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily";
  billingDay?: number | null;
  accountId: string;
  isActive: boolean;
  firstBillingDate: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  subcategory?: { id: string; name: string; logo?: string | null } | null;
  account?: { id: string; name: string } | null;
}

export interface UserServiceSubscriptionFormData {
  serviceName: string;
  subcategoryId?: string | null;
  amount: number;
  description?: string | null;
  billingFrequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily";
  billingDay?: number | null;
  accountId: string;
  firstBillingDate: Date | string;
  // For creating new subcategory
  categoryId?: string | null;
  newSubcategoryName?: string | null;
}

/**
 * Get all user subscriptions
 */
export async function getUserSubscriptions(): Promise<UserServiceSubscription[]> {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("UserServiceSubscription")
    .select("*")
    .eq("userId", user.id)
    .order("createdAt", { ascending: false });

  if (error) {
    logger.error("Supabase error fetching subscriptions:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Enrich with related data
  const enrichedSubscriptions = await Promise.all(
    data.map(async (sub) => {
      const [subcategoryResult, accountResult] = await Promise.all([
        sub.subcategoryId
          ? supabase
              .from("Subcategory")
              .select("id, name, logo")
              .eq("id", sub.subcategoryId)
              .single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("Account")
          .select("id, name")
          .eq("id", sub.accountId)
          .single(),
      ]);

      return {
        ...sub,
        amount: Number(sub.amount),
        subcategory: subcategoryResult.data || null,
        account: accountResult.data || null,
      };
    })
  );

  return enrichedSubscriptions;
}

/**
 * Create a new subscription
 */
export async function createUserSubscription(
  data: UserServiceSubscriptionFormData
): Promise<UserServiceSubscription> {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  let subcategoryId = data.subcategoryId;

  // If creating a new subcategory
  if (data.newSubcategoryName && data.categoryId) {
    try {
      const newSubcategory = await createSubcategory({
        name: data.newSubcategoryName,
        categoryId: data.categoryId,
      });
      subcategoryId = newSubcategory.id;
    } catch (error) {
      logger.error("Error creating subcategory:", error);
      throw new Error(
        `Failed to create subcategory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  const id = crypto.randomUUID();
  const now = formatTimestamp(new Date());
  const firstBillingDate = formatDateOnly(new Date(data.firstBillingDate));

  const subscriptionData = {
    id,
    userId: user.id,
    serviceName: data.serviceName.trim(),
    subcategoryId: subcategoryId || null,
    amount: data.amount,
    description: data.description?.trim() || null,
    billingFrequency: data.billingFrequency,
    accountId: data.accountId,
    isActive: true,
    firstBillingDate,
    createdAt: now,
    updatedAt: now,
  };

  const { data: subscription, error } = await supabase
    .from("UserServiceSubscription")
    .insert(subscriptionData)
    .select()
    .single();

  if (error) {
    logger.error("Supabase error creating subscription:", error);
    throw new Error(
      `Failed to create subscription: ${error.message || JSON.stringify(error)}`
    );
  }

  // Create planned payments for this subscription
  if (subscription.isActive) {
    try {
      await createSubscriptionPlannedPayments(subscription);
    } catch (error) {
      // Log error but don't fail subscription creation
      logger.error("Error creating subscription planned payments:", error);
    }
  }

  // Enrich with related data
  const enrichedSubscription = await enrichSubscription(subscription, supabase);

  return enrichedSubscription;
}

/**
 * Update an existing subscription
 */
export async function updateUserSubscription(
  id: string,
  data: Partial<UserServiceSubscriptionFormData>
): Promise<UserServiceSubscription> {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Verify ownership
  const { data: existing, error: checkError } = await supabase
    .from("UserServiceSubscription")
    .select("id, isActive")
    .eq("id", id)
    .eq("userId", user.id)
    .single();

  if (checkError || !existing) {
    throw new Error("Subscription not found");
  }

  let subcategoryId = data.subcategoryId;

  // If creating a new subcategory
  if (data.newSubcategoryName && data.categoryId) {
    try {
      const newSubcategory = await createSubcategory({
        name: data.newSubcategoryName,
        categoryId: data.categoryId,
      });
      subcategoryId = newSubcategory.id;
    } catch (error) {
      logger.error("Error creating subcategory:", error);
      throw new Error(
        `Failed to create subcategory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  const updateData: any = {
    updatedAt: formatTimestamp(new Date()),
  };

  if (data.serviceName !== undefined) {
    updateData.serviceName = data.serviceName.trim();
  }
  if (subcategoryId !== undefined) {
    updateData.subcategoryId = subcategoryId || null;
  }
  if (data.amount !== undefined) {
    updateData.amount = data.amount;
  }
  if (data.description !== undefined) {
    updateData.description = data.description?.trim() || null;
  }
  if (data.billingFrequency !== undefined) {
    updateData.billingFrequency = data.billingFrequency;
  }
  if (data.accountId !== undefined) {
    updateData.accountId = data.accountId;
  }
  if (data.firstBillingDate !== undefined) {
    updateData.firstBillingDate = formatDateOnly(new Date(data.firstBillingDate));
  }

  const { data: updated, error } = await supabase
    .from("UserServiceSubscription")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("Supabase error updating subscription:", error);
    throw new Error(
      `Failed to update subscription: ${error.message || JSON.stringify(error)}`
    );
  }

  // Delete existing planned payments and recreate if active
  await deleteSubscriptionPlannedPayments(id, supabase);

  if (updated.isActive) {
    try {
      await createSubscriptionPlannedPayments(updated);
    } catch (error) {
      logger.error("Error recreating subscription planned payments:", error);
    }
  }

  // Enrich with related data
  const enrichedSubscription = await enrichSubscription(updated, supabase);

  return enrichedSubscription;
}

/**
 * Delete a subscription
 */
export async function deleteUserSubscription(id: string): Promise<void> {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Verify ownership
  const { data: existing, error: checkError } = await supabase
    .from("UserServiceSubscription")
    .select("id")
    .eq("id", id)
    .eq("userId", user.id)
    .single();

  if (checkError || !existing) {
    throw new Error("Subscription not found");
  }

  // Delete planned payments first (cascade should handle this, but being explicit)
  await deleteSubscriptionPlannedPayments(id, supabase);

  const { error } = await supabase
    .from("UserServiceSubscription")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("Supabase error deleting subscription:", error);
    throw new Error(
      `Failed to delete subscription: ${error.message || JSON.stringify(error)}`
    );
  }
}

/**
 * Pause a subscription
 */
export async function pauseUserSubscription(id: string): Promise<UserServiceSubscription> {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Verify ownership
  const { data: existing, error: checkError } = await supabase
    .from("UserServiceSubscription")
    .select("id, isActive")
    .eq("id", id)
    .eq("userId", user.id)
    .single();

  if (checkError || !existing) {
    throw new Error("Subscription not found");
  }

  if (!existing.isActive) {
    throw new Error("Subscription is already paused");
  }

  const { data: updated, error } = await supabase
    .from("UserServiceSubscription")
    .update({
      isActive: false,
      updatedAt: formatTimestamp(new Date()),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("Supabase error pausing subscription:", error);
    throw new Error(
      `Failed to pause subscription: ${error.message || JSON.stringify(error)}`
    );
  }

  // Delete planned payments for paused subscription
  await deleteSubscriptionPlannedPayments(id, supabase);

  // Enrich with related data
  const enrichedSubscription = await enrichSubscription(updated, supabase);

  return enrichedSubscription;
}

/**
 * Resume a subscription
 */
export async function resumeUserSubscription(id: string): Promise<UserServiceSubscription> {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Verify ownership
  const { data: existing, error: checkError } = await supabase
    .from("UserServiceSubscription")
    .select("id, isActive")
    .eq("id", id)
    .eq("userId", user.id)
    .single();

  if (checkError || !existing) {
    throw new Error("Subscription not found");
  }

  if (existing.isActive) {
    throw new Error("Subscription is already active");
  }

  const { data: updated, error } = await supabase
    .from("UserServiceSubscription")
    .update({
      isActive: true,
      updatedAt: formatTimestamp(new Date()),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("Supabase error resuming subscription:", error);
    throw new Error(
      `Failed to resume subscription: ${error.message || JSON.stringify(error)}`
    );
  }

  // Recreate planned payments for resumed subscription
  try {
    await createSubscriptionPlannedPayments(updated);
  } catch (error) {
    logger.error("Error recreating subscription planned payments:", error);
  }

  // Enrich with related data
  const enrichedSubscription = await enrichSubscription(updated, supabase);

  return enrichedSubscription;
}

/**
 * Create planned payments for a subscription
 */
async function createSubscriptionPlannedPayments(subscription: any): Promise<void> {
  if (!subscription.accountId || !subscription.isActive) {
    return;
  }

  const firstBillingDate = new Date(subscription.firstBillingDate);
  const amount = subscription.amount;
  const billingFrequency = subscription.billingFrequency || "monthly";

  if (amount <= 0) {
    return;
  }

  const plannedPayments = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate horizon date (PLANNED_HORIZON_DAYS from today)
  const horizonDate = new Date(today);
  horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
  horizonDate.setHours(23, 59, 59, 999);

  // Find the first payment date that is on or after today
  let currentDate = new Date(firstBillingDate);
  currentDate.setHours(0, 0, 0, 0);

  // Calculate next payment dates based on frequency
  let paymentCount = 0;
  const maxPayments = 100; // Safety limit

  while (currentDate <= horizonDate && paymentCount < maxPayments) {
    if (currentDate >= today) {
      plannedPayments.push({
        date: new Date(currentDate),
        type: "expense" as const,
        amount: amount,
        accountId: subscription.accountId,
        categoryId: null, // Subscriptions don't have category, only subcategory
        subcategoryId: subscription.subcategoryId || null,
        description: subscription.serviceName,
        source: "subscription" as const,
        subscriptionId: subscription.id,
      });
    }

    // Calculate next payment date based on frequency and first billing date
    currentDate = calculateNextBillingDate(
      currentDate,
      billingFrequency,
      firstBillingDate
    );
    paymentCount++;
  }

  if (plannedPayments.length === 0) {
    logger.info(
      `No future planned payments to create for subscription ${subscription.id}`
    );
    return;
  }

  // Create planned payments in batches
  const batchSize = 50;
  for (let i = 0; i < plannedPayments.length; i += batchSize) {
    const batch = plannedPayments.slice(i, i + batchSize);
    await Promise.all(
      batch.map((pp) =>
        createPlannedPayment(pp).catch((error) => {
          logger.error(
            `Error creating planned payment for subscription ${subscription.id} on ${pp.date}:`,
            error
          );
        })
      )
    );
  }

  logger.info(
    `Created ${plannedPayments.length} planned payments for subscription ${subscription.id}`
  );
}

/**
 * Calculate next billing date based on frequency and first billing date
 * Uses the day of month from firstBillingDate as reference
 */
function calculateNextBillingDate(
  currentDate: Date,
  frequency: string,
  firstBillingDate: Date
): Date {
  const nextDate = new Date(currentDate);
  const dayOfMonth = firstBillingDate.getDate();

  if (frequency === "yearly") {
    // Next year, same month and day as first billing date
    const nextYear = addYears(nextDate, 1);
    const targetMonth = firstBillingDate.getMonth();
    const targetDate = new Date(nextYear.getFullYear(), targetMonth, Math.min(dayOfMonth, 28));
    // If day is 31, use last day of month
    if (dayOfMonth === 31) {
      const lastDay = new Date(nextYear.getFullYear(), targetMonth + 1, 0);
      return lastDay;
    }
    return targetDate;
  } else if (frequency === "monthly") {
    // Next month, same day of month as first billing date
    const nextMonth = addMonths(nextDate, 1);
    const monthStart = startOfMonth(nextMonth);
    const targetDate = setDate(monthStart, Math.min(dayOfMonth, 28)); // Handle months with < 31 days
    // If day is 31, use last day of month
    if (dayOfMonth === 31) {
      const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
      return lastDay;
    }
    return targetDate;
  }

  // Default fallback to monthly
  return addMonths(nextDate, 1);
}

/**
 * Delete all planned payments for a subscription
 */
async function deleteSubscriptionPlannedPayments(
  subscriptionId: string,
  supabase: any
): Promise<void> {
  const { error } = await supabase
    .from("PlannedPayment")
    .delete()
    .eq("subscriptionId", subscriptionId);

  if (error) {
    logger.error(
      `Error deleting planned payments for subscription ${subscriptionId}:`,
      error
    );
  }
}

/**
 * Enrich subscription with related data
 */
async function enrichSubscription(
  subscription: any,
  supabase: any
): Promise<UserServiceSubscription> {
  const [subcategoryResult, accountResult] = await Promise.all([
    subscription.subcategoryId
      ? supabase
          .from("Subcategory")
          .select("id, name, logo")
          .eq("id", subscription.subcategoryId)
          .single()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("Account")
      .select("id, name")
      .eq("id", subscription.accountId)
      .single(),
  ]);

  return {
    ...subscription,
    amount: Number(subscription.amount),
    subcategory: subcategoryResult.data || null,
    account: accountResult.data || null,
  };
}

