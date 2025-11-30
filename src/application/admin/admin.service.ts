/**
 * Admin Service
 * Business logic for admin operations
 * Orchestrates admin operations including users, promo codes, and system categories
 */

import { AdminRepository } from "@/src/infrastructure/database/repositories/admin.repository";
import { AdminUser, PromoCode, SystemGroup, SystemCategory, SystemSubcategory } from "../../domain/admin/admin.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import Stripe from "stripe";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
import { AppError } from "../shared/app-error";

// Helper function to invalidate all categories cache
async function invalidateAllCategoriesCache(): Promise<void> {
  const service = makeCategoriesService();
  await service.invalidateAllCategoriesCache();
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new AppError("STRIPE_SECRET_KEY is not set", 500);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export class AdminService {
  constructor(private repository: AdminRepository) {}

  /**
   * Check if user is super_admin
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.repository.isSuperAdmin(userId);
  }

  /**
   * Get all users with subscription and household information
   */
  async getAllUsers(): Promise<AdminUser[]> {
    return this.repository.getAllUsers();
  }

  /**
   * Check if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    return this.repository.userExists(userId);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<{ id: string; email: string; isBlocked: boolean } | null> {
    return this.repository.getUserById(userId);
  }

  /**
   * Block or unblock a user
   */
  async blockUser(
    userId: string,
    isBlocked: boolean,
    options?: {
      reason?: string;
      blockedBy?: string;
      pauseSubscription?: boolean;
    }
  ): Promise<void> {
    // Verify user exists
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // If unblocking, verify user is currently blocked
    if (!isBlocked && !user.isBlocked) {
      throw new AppError("User is not currently blocked", 400);
    }

    // Block user in database
    await this.repository.blockUser(
      userId,
      isBlocked,
      options?.reason,
      options?.blockedBy
    );

    // Pause/resume subscription in Stripe if requested
    if (options?.pauseSubscription) {
      const supabase = await createServerClient();
      const { data: subscription } = await supabase
        .from("Subscription")
        .select("stripeSubscriptionId, status")
        .eq("userId", userId)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.stripeSubscriptionId) {
        try {
          if (isBlocked) {
            await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
              pause_collection: {
                behavior: "keep_as_draft",
              },
            });
          } else {
            await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
              pause_collection: null,
            });
          }
        } catch (error) {
          // Log but don't fail - user is still blocked in database
          console.error("Error updating subscription in Stripe:", error);
        }
      }
    }
  }

  /**
   * Get all promo codes
   */
  async getAllPromoCodes(): Promise<PromoCode[]> {
    return this.repository.getAllPromoCodes();
  }

  /**
   * Create a promo code and corresponding Stripe coupon
   */
  async createPromoCode(data: {
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    duration: "once" | "forever" | "repeating";
    durationInMonths?: number;
    maxRedemptions?: number;
    expiresAt?: Date;
    planIds?: string[];
  }): Promise<PromoCode> {
    // Create Stripe coupon
    const stripeCouponParams: Stripe.CouponCreateParams = {
      id: data.code.toUpperCase(),
      name: data.code,
    };

    if (data.discountType === "percent") {
      stripeCouponParams.percent_off = data.discountValue;
    } else {
      stripeCouponParams.amount_off = Math.round(data.discountValue * 100);
      stripeCouponParams.currency = "usd";
    }

    if (data.duration === "once") {
      stripeCouponParams.duration = "once";
    } else if (data.duration === "forever") {
      stripeCouponParams.duration = "forever";
    } else {
      stripeCouponParams.duration = "repeating";
      stripeCouponParams.duration_in_months = data.durationInMonths || 1;
    }

    if (data.maxRedemptions) {
      stripeCouponParams.max_redemptions = data.maxRedemptions;
    }

    if (data.expiresAt) {
      stripeCouponParams.redeem_by = Math.floor(data.expiresAt.getTime() / 1000);
    }

    const stripeCoupon = await stripe.coupons.create(stripeCouponParams);

    // Create promo code in database
    const promoCodeId = `promo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      return await this.repository.createPromoCode({
        id: promoCodeId,
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        discountValue: data.discountValue,
        duration: data.duration,
        durationInMonths: data.durationInMonths || null,
        maxRedemptions: data.maxRedemptions || null,
        expiresAt: data.expiresAt || null,
        isActive: true,
        stripeCouponId: stripeCoupon.id,
        planIds: data.planIds || [],
      });
    } catch (error) {
      // If database insert fails, try to delete the Stripe coupon
      try {
        await stripe.coupons.del(stripeCoupon.id);
      } catch (delError) {
        console.error("Error deleting Stripe coupon after failed insert:", delError);
      }
      throw error;
    }
  }

  /**
   * Update a promo code
   */
  async updatePromoCode(
    id: string,
    data: Partial<PromoCode>
  ): Promise<PromoCode> {
    // Get existing promo code to check Stripe coupon
    const existing = await this.repository.getAllPromoCodes();
    const promoCode = existing.find(pc => pc.id === id);
    
    // Update Stripe coupon if needed (can only delete and recreate)
    if (promoCode?.stripeCouponId && (data.isActive === false || data.expiresAt !== undefined)) {
      try {
        if (data.isActive === false) {
          await stripe.coupons.del(promoCode.stripeCouponId);
        }
      } catch (error) {
        console.error("Error updating Stripe coupon:", error);
      }
    }

    return this.repository.updatePromoCode(id, data);
  }

  /**
   * Delete a promo code and corresponding Stripe coupon
   */
  async deletePromoCode(id: string): Promise<void> {
    // Get existing promo code to get Stripe coupon ID
    const existing = await this.repository.getAllPromoCodes();
    const promoCode = existing.find(pc => pc.id === id);

    // Delete from Stripe if exists
    if (promoCode?.stripeCouponId) {
      try {
        await stripe.coupons.del(promoCode.stripeCouponId);
      } catch (error) {
        console.error("Error deleting Stripe coupon:", error);
        // Continue with database deletion even if Stripe deletion fails
      }
    }

    // Delete from database
    await this.repository.deletePromoCode(id);
  }

  /**
   * Toggle promo code active status
   */
  async togglePromoCodeActive(id: string, isActive: boolean): Promise<PromoCode> {
    return this.updatePromoCode(id, { isActive });
  }

  /**
   * Get all system groups
   */
  async getAllSystemGroups(): Promise<SystemGroup[]> {
    return this.repository.getAllSystemGroups();
  }

  /**
   * Create a system group
   */
  async createSystemGroup(data: { name: string; type?: "income" | "expense" }): Promise<SystemGroup> {
    // Check if system group with this name already exists
    const existing = await this.repository.getAllSystemGroups();
    if (existing.some(g => g.name === data.name)) {
      throw new AppError("A system group with this name already exists", 400);
    }

    const id = `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const group = await this.repository.createSystemGroup({
      id,
      name: data.name,
      type: data.type,
    });

    // Invalidate cache for all users
    await invalidateAllCategoriesCache();

    return group;
  }

  /**
   * Update a system group
   */
  async updateSystemGroup(id: string, data: { name?: string; type?: "income" | "expense" }): Promise<SystemGroup> {
    // Verify it's a system group
    const existing = await this.repository.getAllSystemGroups();
    const group = existing.find(g => g.id === id);
    if (!group) {
      throw new AppError("Group not found", 404);
    }

    // Check for duplicate name if updating name
    if (data.name && existing.some(g => g.id !== id && g.name === data.name)) {
      throw new AppError("A system group with this name already exists", 400);
    }

    const updated = await this.repository.updateSystemGroup(id, data);

    // Invalidate cache for all users
    await invalidateAllCategoriesCache();

    return updated;
  }

  /**
   * Delete a system group
   */
  async deleteSystemGroup(id: string): Promise<void> {
    await this.repository.deleteSystemGroup(id);

    // Invalidate cache for all users
    await invalidateAllCategoriesCache();
  }

  /**
   * Get all system categories
   */
  async getAllSystemCategories(): Promise<SystemCategory[]> {
    return this.repository.getAllSystemCategories();
  }

  /**
   * Create a system category
   */
  async createSystemCategory(data: { name: string; macroId: string }): Promise<SystemCategory> {
    // Verify group is a system group
    const groups = await this.repository.getAllSystemGroups();
    const group = groups.find(g => g.id === data.macroId);
    if (!group) {
      throw new AppError("Group not found", 404);
    }

    // Check if system category with this name already exists in this group
    const existing = await this.repository.getAllSystemCategories();
    if (existing.some(c => c.name === data.name && c.macroId === data.macroId)) {
      throw new AppError("A system category with this name already exists in this macro", 400);
    }

    const id = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const category = await this.repository.createSystemCategory({
      id,
      name: data.name,
      macroId: data.macroId,
    });

    // Invalidate cache for all users
    await invalidateAllCategoriesCache();

    return category;
  }

  /**
   * Update a system category
   */
  async updateSystemCategory(id: string, data: { name?: string; macroId?: string }): Promise<SystemCategory> {
    // Verify it's a system category
    const existing = await this.repository.getAllSystemCategories();
    const category = existing.find(c => c.id === id);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    // Verify new group is a system group if macroId is being updated
    if (data.macroId) {
      const groups = await this.repository.getAllSystemGroups();
      if (!groups.some(g => g.id === data.macroId)) {
        throw new AppError("Group not found", 404);
      }
    }

    // Check for duplicate name
    if (data.name) {
      const targetMacroId = data.macroId || category.macroId;
      if (existing.some(c => c.id !== id && c.name === data.name && c.macroId === targetMacroId)) {
        throw new AppError("A system category with this name already exists in this group", 400);
      }
    }

    const updated = await this.repository.updateSystemCategory(id, data);

    // Invalidate cache for all users
    await invalidateAllCategoriesCache();

    return updated;
  }

  /**
   * Delete a system category
   */
  async deleteSystemCategory(id: string): Promise<void> {
    await this.repository.deleteSystemCategory(id);

    // Invalidate cache for all users
    await invalidateAllCategoriesCache();
  }

  /**
   * Get all system subcategories
   */
  async getAllSystemSubcategories(): Promise<SystemSubcategory[]> {
    return this.repository.getAllSystemSubcategories();
  }

  /**
   * Create a system subcategory
   */
  async createSystemSubcategory(data: { name: string; categoryId: string; logo?: string | null }): Promise<SystemSubcategory> {
    // Verify category is a system category
    const categories = await this.repository.getAllSystemCategories();
    const category = categories.find(c => c.id === data.categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    // Check if system subcategory with this name already exists in this category
    const existing = await this.repository.getAllSystemSubcategories();
    if (existing.some(s => s.name === data.name && s.categoryId === data.categoryId)) {
      throw new AppError("A system subcategory with this name already exists in this category", 400);
    }

    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const subcategory = await this.repository.createSystemSubcategory({
      id,
      name: data.name,
      categoryId: data.categoryId,
      logo: data.logo,
    });

    // Invalidate cache for all users
    await invalidateAllCategoriesCache();

    return subcategory;
  }

  /**
   * Update a system subcategory
   */
  async updateSystemSubcategory(id: string, data: { name?: string; logo?: string | null }): Promise<SystemSubcategory> {
    // Verify it's a system subcategory
    const existing = await this.repository.getAllSystemSubcategories();
    const subcategory = existing.find(s => s.id === id);
    if (!subcategory) {
      throw new AppError("Subcategory not found", 404);
    }

    // Check for duplicate name
    if (data.name && existing.some(s => s.id !== id && s.name === data.name && s.categoryId === subcategory.categoryId)) {
      throw new AppError("A system subcategory with this name already exists in this category", 400);
    }

    const updated = await this.repository.updateSystemSubcategory(id, data);

    // Invalidate cache for all users
    await invalidateAllCategoriesCache();

    return updated;
  }

  /**
   * Delete a system subcategory
   */
  async deleteSystemSubcategory(id: string): Promise<void> {
    await this.repository.deleteSystemSubcategory(id);

    // Invalidate cache for all users
    await invalidateAllCategoriesCache();
  }


  /**
   * Get system settings
   */
  async getSystemSettings(): Promise<{ maintenanceMode: boolean }> {
    return this.repository.getSystemSettings();
  }

  /**
   * Update system settings
   */
  async updateSystemSettings(data: { maintenanceMode: boolean }): Promise<{ maintenanceMode: boolean }> {
    return this.repository.updateSystemSettings(data);
  }

  /**
   * Get all plans
   */
  async getAllPlans(): Promise<any[]> {
    return this.repository.getAllPlans();
  }

  /**
   * Update a plan
   */
  async updatePlan(
    planId: string,
    data: {
      name?: string;
      features?: any;
      priceMonthly?: number;
      priceYearly?: number;
    }
  ): Promise<{ plan: any; stripeSync: { success: boolean; warnings?: string[]; error?: string } }> {
    // Validate features if provided
    if (data.features) {
      try {
        const { validateFeaturesForSave } = await import("@/lib/api/plan-features-service");
        validateFeaturesForSave(data.features);
      } catch (error) {
        throw new AppError(`Invalid features format: ${error instanceof Error ? error.message : "Unknown error"}`, 400);
      }
    }

    // Update plan in database
    const updatedPlan = await this.repository.updatePlan(planId, data);

    // Invalidate plans cache
    const { invalidatePlansCache } = await import("@/lib/api/subscription");
    await invalidatePlansCache();

    // Invalidate subscription cache for all users with this plan
    const { invalidateSubscriptionsForPlan } = await import("@/lib/api/subscription");
    await invalidateSubscriptionsForPlan(planId);

    // Sync to Stripe if plan has stripeProductId
    let stripeSync: { success: boolean; warnings?: string[]; error?: string } = { success: true };
    if (updatedPlan.stripeProductId) {
      try {
        const { syncPlanToStripe } = await import("@/lib/api/stripe");
        const syncResult = await syncPlanToStripe(planId);
        if (!syncResult.success) {
          stripeSync = {
            success: false,
            warnings: syncResult.warnings,
            error: syncResult.error,
          };
        }
      } catch (stripeError) {
        // Don't fail the request if Stripe sync fails, but log it
        stripeSync = {
          success: false,
          error: stripeError instanceof Error ? stripeError.message : "Unknown error",
        };
      }
    }

    return {
      plan: updatedPlan,
      stripeSync,
    };
  }

  /**
   * Get all feedbacks with pagination and metrics
   */
  async getFeedbacks(options?: { limit?: number; offset?: number }): Promise<{
    feedbacks: any[];
    total: number;
    metrics: {
      total: number;
      averageRating: number;
      ratingDistribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
      };
    };
  }> {
    return this.repository.getFeedbacks(options);
  }

  /**
   * Get all contact forms with pagination
   */
  async getContactForms(options?: { status?: string; limit?: number; offset?: number }): Promise<{
    contactForms: any[];
    total: number;
  }> {
    return this.repository.getContactForms(options);
  }

  /**
   * Update a contact form
   */
  async updateContactForm(
    id: string,
    data: {
      status?: string;
      adminNotes?: string;
    }
  ): Promise<any> {
    return this.repository.updateContactForm(id, data);
  }

  /**
   * Get dashboard data with all metrics and calculations
   */
  async getDashboardData(): Promise<{
    overview: {
      totalUsers: number;
      usersWithoutSubscription: number;
      totalSubscriptions: number;
      activeSubscriptions: number;
      trialingSubscriptions: number;
      cancelledSubscriptions: number;
      pastDueSubscriptions: number;
      churnRisk: number;
    };
    financial: {
      mrr: number;
      estimatedFutureMRR: number;
      totalEstimatedMRR: number;
      subscriptionDetails: Array<{
        subscriptionId: string;
        userId: string;
        planId: string;
        planName: string;
        status: string;
        monthlyRevenue: number;
        interval: "month" | "year" | "unknown";
        trialEndDate: string | null;
      }>;
      upcomingTrials: Array<{
        subscriptionId: string;
        userId: string;
        planId: string;
        planName: string;
        trialEndDate: string;
        daysUntilEnd: number;
        estimatedMonthlyRevenue: number;
      }>;
    };
    planDistribution: Array<{
      planId: string;
      planName: string;
      activeCount: number;
      trialingCount: number;
      totalCount: number;
    }>;
  }> {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new AppError("STRIPE_SECRET_KEY is not set", 500);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-10-29.clover",
      typescript: true,
    });

    // Get raw data from repository
    const { totalUsers, subscriptions, plans } = await this.repository.getDashboardRawData();

    const now = new Date();
    const subscriptionsList = subscriptions || [];

    // Calculate metrics
    const activeSubscriptions = subscriptionsList.filter(
      (sub) => sub.status === "active"
    );
    const trialingSubscriptions = subscriptionsList.filter(
      (sub) => sub.status === "trialing"
    );
    const cancelledSubscriptions = subscriptionsList.filter(
      (sub) => sub.status === "cancelled"
    );
    const pastDueSubscriptions = subscriptionsList.filter(
      (sub) => sub.status === "past_due"
    );

    // Calculate MRR (Monthly Recurring Revenue)
    let mrr = 0;
    const subscriptionDetails: Array<{
      subscriptionId: string;
      userId: string;
      planId: string;
      planName: string;
      status: string;
      monthlyRevenue: number;
      interval: "month" | "year" | "unknown";
      trialEndDate: string | null;
    }> = [];

    // Fetch Stripe subscription data in parallel (with error handling)
    const stripeSubscriptions = await Promise.allSettled(
      activeSubscriptions
        .filter((sub) => sub.stripeSubscriptionId)
        .map((sub) =>
          stripe.subscriptions.retrieve(sub.stripeSubscriptionId!).then(
            (stripeSub) => ({ dbSubscriptionId: sub.id, stripeSub }),
            (error) => ({ dbSubscriptionId: sub.id, error })
          )
        )
    );

    // Create a map of database subscription ID to Stripe data
    const stripeSubMap = new Map<string, Stripe.Subscription>();
    stripeSubscriptions.forEach((result) => {
      if (result.status === "fulfilled") {
        const value = result.value as { dbSubscriptionId: string; stripeSub: Stripe.Subscription } | { dbSubscriptionId: string; error: any };
        if (!("error" in value)) {
          stripeSubMap.set(value.dbSubscriptionId, value.stripeSub);
        }
      }
    });

    for (const sub of activeSubscriptions) {
      // Handle plan as array (from Supabase join) or single object
      const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
      if (!plan) continue;

      let monthlyRevenue = 0;
      let interval: "month" | "year" | "unknown" = "unknown";

      // Try to determine interval from Stripe if available
      const stripeSub = sub.stripeSubscriptionId
        ? stripeSubMap.get(sub.id)
        : null;

      if (stripeSub) {
        const priceId = stripeSub.items.data[0]?.price.id;

        if (priceId === plan.stripePriceIdMonthly) {
          interval = "month";
          monthlyRevenue = Number(plan.priceMonthly) || 0;
        } else if (priceId === plan.stripePriceIdYearly) {
          interval = "year";
          // Convert yearly to monthly for MRR
          monthlyRevenue = (Number(plan.priceYearly) || 0) / 12;
        } else {
          // Fallback: assume monthly if we can't determine
          interval = "month";
          monthlyRevenue = Number(plan.priceMonthly) || 0;
        }
      } else {
        // No Stripe subscription ID or failed to fetch, assume monthly
        interval = "month";
        monthlyRevenue = Number(plan.priceMonthly) || 0;
      }

      mrr += monthlyRevenue;

      subscriptionDetails.push({
        subscriptionId: sub.id,
        userId: sub.userId,
        planId: sub.planId,
        planName: plan.name,
        status: sub.status,
        monthlyRevenue,
        interval,
        trialEndDate: sub.trialEndDate,
      });
    }

    // Calculate future revenue from trials
    let estimatedFutureMRR = 0;
    const upcomingTrials: Array<{
      subscriptionId: string;
      userId: string;
      planId: string;
      planName: string;
      trialEndDate: string;
      daysUntilEnd: number;
      estimatedMonthlyRevenue: number;
    }> = [];

    for (const sub of trialingSubscriptions) {
      // Handle plan as array (from Supabase join) or single object
      const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
      if (!plan || !sub.trialEndDate) continue;

      const trialEnd = new Date(sub.trialEndDate);
      const daysUntilEnd = Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only count trials that haven't ended
      if (daysUntilEnd > 0) {
        // Assume they'll convert to monthly plan
        const estimatedMonthlyRevenue = Number(plan.priceMonthly) || 0;
        estimatedFutureMRR += estimatedMonthlyRevenue;

        upcomingTrials.push({
          subscriptionId: sub.id,
          userId: sub.userId,
          planId: sub.planId,
          planName: plan.name,
          trialEndDate: sub.trialEndDate,
          daysUntilEnd,
          estimatedMonthlyRevenue,
        });
      }
    }

    // Sort upcoming trials by days until end
    upcomingTrials.sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);

    // Calculate distribution by plan
    const planDistribution: Record<
      string,
      {
        planId: string;
        planName: string;
        activeCount: number;
        trialingCount: number;
        totalCount: number;
      }
    > = {};

    plans?.forEach((plan) => {
      planDistribution[plan.id] = {
        planId: plan.id,
        planName: plan.name,
        activeCount: 0,
        trialingCount: 0,
        totalCount: 0,
      };
    });

    subscriptionsList.forEach((sub) => {
      // Handle plan as array (from Supabase join) or single object
      const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
      if (plan && planDistribution[sub.planId]) {
        planDistribution[sub.planId].totalCount++;
        if (sub.status === "active") {
          planDistribution[sub.planId].activeCount++;
        } else if (sub.status === "trialing") {
          planDistribution[sub.planId].trialingCount++;
        }
      }
    });

    // Calculate users without subscription
    const usersWithSubscription = new Set(
      subscriptionsList.map((sub) => sub.userId)
    );
    const usersWithoutSubscription =
      (totalUsers || 0) - usersWithSubscription.size;

    // Calculate churn risk (subscriptions that will cancel at period end)
    const churnRisk = activeSubscriptions.filter(
      (sub) => sub.cancelAtPeriodEnd === true
    ).length;

    return {
      overview: {
        totalUsers: totalUsers || 0,
        usersWithoutSubscription,
        totalSubscriptions: subscriptionsList.length,
        activeSubscriptions: activeSubscriptions.length,
        trialingSubscriptions: trialingSubscriptions.length,
        cancelledSubscriptions: cancelledSubscriptions.length,
        pastDueSubscriptions: pastDueSubscriptions.length,
        churnRisk,
      },
      financial: {
        mrr: Math.round(mrr * 100) / 100, // Round to 2 decimals
        estimatedFutureMRR: Math.round(estimatedFutureMRR * 100) / 100,
        totalEstimatedMRR: Math.round((mrr + estimatedFutureMRR) * 100) / 100,
        subscriptionDetails,
        upcomingTrials: upcomingTrials.slice(0, 10), // Top 10 upcoming trials
      },
      planDistribution: Object.values(planDistribution),
    };
  }
}

