/**
 * User Subscriptions Service
 * Business logic for user service subscriptions (Netflix, Spotify, etc.)
 */

import { UserSubscriptionsRepository, UserServiceSubscriptionRow } from "@/src/infrastructure/database/repositories/user-subscriptions.repository";
import { UserServiceSubscription, UserServiceSubscriptionFormData } from "../../domain/subscriptions/subscriptions.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { logger } from "@/src/infrastructure/utils/logger";
import { makeCategoriesService } from "../categories/categories.factory";
import { makePlannedPaymentsService } from "../planned-payments/planned-payments.factory";
import { AppError } from "../shared/app-error";

const PLANNED_HORIZON_DAYS = 365; // 1 year horizon for planned payments

export class UserSubscriptionsService {
  constructor(private repository: UserSubscriptionsRepository) {}

  /**
   * Get all user service subscriptions (e.g., Netflix, Spotify, etc.)
   * 
   * ⚠️ IMPORTANT: This returns EXTERNAL service subscriptions, NOT Spare Finance app subscriptions.
   * For app subscriptions, use SubscriptionsService.
   * 
   * Note: This method returns user service subscriptions, NOT Stripe subscription plans.
   * User service subscriptions are recurring payments for external services that the user
   * manually tracks (like streaming services, gym memberships, etc.).
   * 
   * @param userId - The user ID to fetch subscriptions for
   * @returns Array of user service subscriptions with enriched data (subcategory, account, service logo, plan)
   */
  async getUserSubscriptions(userId: string): Promise<UserServiceSubscription[]> {
    try {
      logger.debug(
        `[UserSubscriptionsService] Fetching user service subscriptions (Netflix, Spotify, etc.) ` +
        `for user: ${userId}`
      );

      // Get active household ID for filtering
      const householdId = await getActiveHouseholdId(userId);
      const rows = await this.repository.findAll(userId, householdId || undefined);
      
      // Enrich with related data
      const enriched = await Promise.all(
        rows.map(async (row) => this.enrichSubscription(row))
      );

      if (enriched.length === 0) {
        logger.debug(
          `[UserSubscriptionsService] No user service subscriptions found for user: ${userId}. ` +
          `This is expected if the user hasn't added any service subscriptions yet.`
        );
      } else {
        logger.debug(
          `[UserSubscriptionsService] Found ${enriched.length} user service subscription(s) ` +
          `for user: ${userId}`,
          {
            serviceNames: enriched.map(s => s.serviceName),
            activeCount: enriched.filter(s => s.isActive).length,
          }
        );
      }

      return enriched;
    } catch (error: unknown) {
      // Handle permission denied errors gracefully (can happen during SSR)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string })?.code;
      if (errorCode === '42501' || errorMessage.includes('permission denied')) {
        logger.warn("[UserSubscriptionsService] Permission denied fetching subscriptions - user may not be authenticated");
        return [];
      }
      logger.error("[UserSubscriptionsService] Error fetching user service subscriptions:", error);
      throw new AppError("Failed to fetch subscriptions", 500);
    }
  }

  /**
   * Create a new subscription
   */
  async createUserSubscription(
    userId: string,
    data: UserServiceSubscriptionFormData
  ): Promise<UserServiceSubscription> {
    try {
      let subcategoryId = data.subcategoryId;

      // If creating a new subcategory
      if (data.newSubcategoryName && data.categoryId) {
        const categoriesService = makeCategoriesService();
        // Resolve category id: client may send subscription-service category id (e.g. "Streaming Video")
        // which is not in the categories table; fallback to first category whose name contains "subscription"
        let resolvedCategoryId = data.categoryId;
        const category = await categoriesService.getCategoryById(resolvedCategoryId);
        if (!category) {
          resolvedCategoryId = await categoriesService.getOrCreateSubscriptionCategoryId();
        }
        const newSubcategory = await categoriesService.createSubcategory({
          name: data.newSubcategoryName,
          categoryId: resolvedCategoryId,
        });
        subcategoryId = newSubcategory.id;
      }

      // Get active household ID
      const householdId = await getActiveHouseholdId(userId);
      if (!householdId) {
        throw new AppError("No active household found. Please contact support.", 400);
      }

      const id = crypto.randomUUID();
      const now = formatTimestamp(new Date());
      const firstBillingDate = formatDateOnly(new Date(data.firstBillingDate));
      const firstBillingDateObj = new Date(data.firstBillingDate);

      // Satisfy DB check constraint on billing_day: either NULL or integer 1-31. Derive from firstBillingDate for monthly/yearly when missing; never send 0 or NaN.
      let billingDay: number | null = data.billingDay ?? null;
      if (billingDay != null) {
        const n = Number(billingDay);
        if (Number.isNaN(n) || n < 1 || n > 31) billingDay = null;
        else billingDay = Math.floor(n);
      }
      if (billingDay == null && (data.billingFrequency === "monthly" || data.billingFrequency === "yearly")) {
        const dayOfMonth = firstBillingDateObj.getDate();
        if (!Number.isNaN(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31) {
          billingDay = dayOfMonth;
        }
      }
      // If constraint allows only NULL, repository will omit or coerce; if it requires 1-31, we've ensured a valid value or null.
      const subscriptionData = {
        id,
        userId,
        householdId,
        serviceName: data.serviceName.trim(),
        subcategoryId: subcategoryId || null,
        planId: data.planId || null,
        amount: data.amount,
        description: data.description?.trim() || null,
        billingFrequency: data.billingFrequency,
        billingDay,
        accountId: data.accountId,
        isActive: true,
        firstBillingDate,
        createdAt: now,
        updatedAt: now,
      };

      const row = await this.repository.create(subscriptionData);

      // Create planned payments for this subscription
      if (row.is_active) {
        try {
          await this.createSubscriptionPlannedPayments(row);
        } catch (error) {
          // Log error but don't fail subscription creation
          logger.error("[UserSubscriptionsService] Error creating planned payments:", error);
        }
      }

      // Enrich with related data
      const enriched = await this.enrichSubscription(row);


      return enriched;
    } catch (error) {
      logger.error("[UserSubscriptionsService] Error creating subscription:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to create subscription", 500);
    }
  }

  /**
   * Enrich subscription with related data
   */
  private async enrichSubscription(row: UserServiceSubscriptionRow): Promise<UserServiceSubscription> {
    const supabase = await createServerClient();

    const [subcategoryResult, accountResult, serviceResult, planResult] = await Promise.all([
      row.subcategory_id
        ? supabase
            .from("subcategories")
            .select("id, name, logo, category_id")
            .eq("id", row.subcategory_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("accounts")
        .select("id, name")
        .eq("id", row.account_id)
        .single(),
      row.service_name
        ? supabase
            .from("external_services")
            .select("name, logo")
            .eq("name", row.service_name)
            .single()
        : Promise.resolve({ data: null, error: null }),
      row.plan_id
        ? supabase
            .from("subscription_service_plans")
            .select("id, plan_name")
            .eq("id", row.plan_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Fetch parent category (Subscription Category the user selected) for display
    const categoryId = subcategoryResult.data && "category_id" in subcategoryResult.data
      ? (subcategoryResult.data as { category_id: string }).category_id
      : null;
    const categoryResult = categoryId
      ? await supabase
          .from("categories")
          .select("id, name")
          .eq("id", categoryId)
          .single()
      : { data: null, error: null };

    const subcategoryData = subcategoryResult.data
      ? { id: subcategoryResult.data.id, name: subcategoryResult.data.name, logo: subcategoryResult.data.logo ?? null }
      : null;

    // Map snake_case database fields to camelCase domain fields
    return {
      id: row.id,
      userId: row.user_id,
      serviceName: row.service_name,
      subcategoryId: row.subcategory_id || null,
      planId: row.plan_id || null,
      amount: Number(row.amount),
      description: row.description || null,
      billingFrequency: row.billing_frequency as "monthly" | "yearly" | "weekly" | "biweekly" | "semimonthly" | "daily",
      billingDay: row.billing_day || null,
      accountId: row.account_id,
      isActive: row.is_active,
      firstBillingDate: row.first_billing_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Relations
      subcategory: subcategoryData,
      category: categoryResult.data ? { id: categoryResult.data.id, name: categoryResult.data.name } : null,
      account: accountResult.data || null,
      serviceLogo: serviceResult.data?.logo || null,
      plan: planResult.data ? {
        id: planResult.data.id,
        planName: planResult.data.plan_name,
      } : null,
    };
  }

  /**
   * Create planned payments for a subscription
   */
  private async createSubscriptionPlannedPayments(subscription: UserServiceSubscriptionRow): Promise<void> {
    if (!subscription.account_id || !subscription.is_active) {
      return;
    }

    const { addMonths, startOfMonth, setDate } = await import("date-fns");
    const plannedPaymentsService = makePlannedPaymentsService();

    const firstBillingDate = new Date(subscription.first_billing_date);
    const amount: number = typeof subscription.amount === 'string' ? parseFloat(subscription.amount) : subscription.amount;
    const billingFrequency = subscription.billing_frequency || "monthly";

    if (amount <= 0 || isNaN(amount)) {
      return;
    }

    const plannedPayments = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const horizonDate = new Date(today);
    horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
    horizonDate.setHours(23, 59, 59, 999);

    let currentDate = new Date(firstBillingDate);
    currentDate.setHours(0, 0, 0, 0);

    let paymentCount = 0;
    const maxPayments = 100;

    while (currentDate <= horizonDate && paymentCount < maxPayments) {
      // Only create planned payments for future dates (not today or past)
      // This prevents creating planned payments that would be immediately processed
      if (currentDate > today) {
        plannedPayments.push({
          date: new Date(currentDate),
          type: "expense" as const,
          amount: amount,
          accountId: subscription.account_id,
          categoryId: null,
          subcategoryId: subscription.subcategory_id || null,
          description: subscription.service_name,
          source: "subscription" as const,
          subscriptionId: subscription.id,
        });
      }

      // Calculate next payment date
      if (billingFrequency === "monthly") {
        const nextMonth = addMonths(currentDate, 1);
        const monthStart = startOfMonth(nextMonth);
        const dayOfMonth = firstBillingDate.getDate();
        currentDate = setDate(monthStart, Math.min(dayOfMonth, 28));
        if (dayOfMonth === 31) {
          const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
          currentDate = lastDay;
        }
      } else if (billingFrequency === "yearly") {
        currentDate = addMonths(currentDate, 12);
      } else {
        // Default to monthly for other frequencies (can be extended)
        currentDate = addMonths(currentDate, 1);
      }
      paymentCount++;
    }

    if (plannedPayments.length === 0) {
      return;
    }

    // Create planned payments in batches
    const batchSize = 50;
    for (let i = 0; i < plannedPayments.length; i += batchSize) {
      const batch = plannedPayments.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map((pp) =>
          plannedPaymentsService.createPlannedPayment(pp).catch((error) => {
            logger.error(
              `[UserSubscriptionsService] Error creating planned payment:`,
              error
            );
          })
        )
      );
    }
  }

  /**
   * Update an existing subscription
   */
  async updateUserSubscription(
    userId: string,
    id: string,
    data: Partial<UserServiceSubscriptionFormData>
  ): Promise<UserServiceSubscription> {
    try {
      // Verify ownership
      const existing = await this.repository.findById(id);
      if (!existing || existing.user_id !== userId) {
        throw new AppError("Subscription not found", 404);
      }

      let subcategoryId = data.subcategoryId;

      // If creating a new subcategory
      if (data.newSubcategoryName && data.categoryId) {
        const categoriesService = makeCategoriesService();
        const newSubcategory = await categoriesService.createSubcategory({
          name: data.newSubcategoryName,
          categoryId: data.categoryId,
        });
        subcategoryId = newSubcategory.id;
      }

      // Map camelCase to pass to repository (repository maps to snake_case internally)
      const updateData: {
        serviceName?: string;
        subcategoryId?: string | null;
        planId?: string | null;
        amount?: number;
        description?: string | null;
        billingFrequency?: string;
        billingDay?: number | null;
        accountId?: string;
        isActive?: boolean;
        firstBillingDate?: string;
        updatedAt: string;
      } = {
        updatedAt: formatTimestamp(new Date()),
      };

      if (data.serviceName !== undefined) {
        updateData.serviceName = data.serviceName.trim();
      }
      if (subcategoryId !== undefined) {
        updateData.subcategoryId = subcategoryId || null;
      }
      if (data.planId !== undefined) {
        updateData.planId = data.planId || null;
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
      // DB constraint: monthly/yearly require billing_day 1-31. Set or derive when updating frequency to monthly/yearly.
      if (data.billingDay !== undefined) {
        const n = Number(data.billingDay);
        updateData.billingDay =
          data.billingDay != null && !Number.isNaN(n) && n >= 1 && n <= 31 ? Math.floor(n) : null;
      } else if (
        updateData.billingFrequency === "monthly" ||
        updateData.billingFrequency === "yearly"
      ) {
        const dateSource = data.firstBillingDate !== undefined
          ? new Date(data.firstBillingDate)
          : new Date(existing.first_billing_date);
        const dayOfMonth = dateSource.getDate();
        if (!Number.isNaN(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31) {
          updateData.billingDay = dayOfMonth;
        } else {
          updateData.billingDay = existing.billing_day != null && existing.billing_day >= 1 && existing.billing_day <= 31
            ? existing.billing_day
            : 1;
        }
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      const updated = await this.repository.update(id, updateData);

      // Delete existing planned payments and recreate if active
      await this.deleteSubscriptionPlannedPayments(id);

      if (updated.is_active) {
        try {
          await this.createSubscriptionPlannedPayments(updated);
        } catch (error) {
          logger.error("[UserSubscriptionsService] Error recreating subscription planned payments:", error);
        }
      }

      // Enrich with related data
      const enriched = await this.enrichSubscription(updated);


      return enriched;
    } catch (error) {
      logger.error("[UserSubscriptionsService] Error updating subscription:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to update subscription", 500);
    }
  }

  /**
   * Delete a subscription
   */
  async deleteUserSubscription(userId: string, id: string): Promise<void> {
    try {
      // Verify ownership
      const existing = await this.repository.findById(id);
      if (!existing || existing.user_id !== userId) {
        throw new AppError("Subscription not found", 404);
      }

      // Delete planned payments first
      await this.deleteSubscriptionPlannedPayments(id);

      await this.repository.delete(id);

    } catch (error) {
      logger.error("[UserSubscriptionsService] Error deleting subscription:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to delete subscription", 500);
    }
  }

  /**
   * Pause a subscription
   */
  async pauseUserSubscription(userId: string, id: string): Promise<UserServiceSubscription> {
    try {
      // Verify ownership
      const existing = await this.repository.findById(id);
      if (!existing || existing.user_id !== userId) {
        throw new AppError("Subscription not found", 404);
      }

      if (!existing.is_active) {
        throw new AppError("Subscription is already paused", 400);
      }

      const updated = await this.repository.update(id, {
        isActive: false,
        updatedAt: formatTimestamp(new Date()),
      });

      // Delete planned payments for paused subscription
      await this.deleteSubscriptionPlannedPayments(id);

      // Enrich with related data
      const enriched = await this.enrichSubscription(updated);


      return enriched;
    } catch (error) {
      logger.error("[UserSubscriptionsService] Error pausing subscription:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to pause subscription", 500);
    }
  }

  /**
   * Resume a subscription
   */
  async resumeUserSubscription(userId: string, id: string): Promise<UserServiceSubscription> {
    try {
      // Verify ownership
      const existing = await this.repository.findById(id);
      if (!existing || existing.user_id !== userId) {
        throw new AppError("Subscription not found", 404);
      }

      if (existing.is_active) {
        throw new AppError("Subscription is already active", 400);
      }

      const updated = await this.repository.update(id, {
        isActive: true,
        updatedAt: formatTimestamp(new Date()),
      });

      // Recreate planned payments for resumed subscription
      try {
        await this.createSubscriptionPlannedPayments(updated);
      } catch (error) {
        logger.error("[UserSubscriptionsService] Error recreating subscription planned payments:", error);
      }

      // Enrich with related data
      const enriched = await this.enrichSubscription(updated);


      return enriched;
    } catch (error) {
      logger.error("[UserSubscriptionsService] Error resuming subscription:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to resume subscription", 500);
    }
  }

  /**
   * Delete planned payments for a subscription
   */
  private async deleteSubscriptionPlannedPayments(subscriptionId: string): Promise<void> {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("planned_payments")
      .delete()
        .eq("subscription_id", subscriptionId);

    if (error) {
      logger.error(
        `[UserSubscriptionsService] Error deleting planned payments for subscription ${subscriptionId}:`,
        error
      );
    }
  }
}

