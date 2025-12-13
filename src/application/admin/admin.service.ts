/**
 * Admin Service
 * Business logic for admin operations
 * Orchestrates admin operations including users, promo codes, and system categories
 */

import { AdminRepository } from "@/src/infrastructure/database/repositories/admin.repository";
import { AuthRepository } from "@/src/infrastructure/database/repositories/auth.repository";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";
import { CategoriesRepository } from "@/src/infrastructure/database/repositories/categories.repository";
import { SubscriptionServicesRepository } from "@/src/infrastructure/database/repositories/subscription-services.repository";
import { AdminUser, PromoCode, SystemCategory, SystemSubcategory } from "../../domain/admin/admin.types";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import Stripe from "stripe";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
import { AppError } from "../shared/app-error";
import { logger } from "@/src/infrastructure/utils/logger";


if (!process.env.STRIPE_SECRET_KEY) {
  throw new AppError("STRIPE_SECRET_KEY is not set", 500);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

/**
 * SEO Settings type
 */
type SEOSettings = Record<string, unknown>;

export class AdminService {
  constructor(
    private repository: AdminRepository,
    private authRepository: AuthRepository,
    private accountsRepository: AccountsRepository,
    private categoriesRepository: CategoriesRepository,
    private subscriptionServicesRepository: SubscriptionServicesRepository
  ) {}

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

    // Clear user verification cache since user status changed
    const { clearUserVerificationCache } = await import("@/lib/utils/verify-user-exists");
    await clearUserVerificationCache(userId);

    // Pause/resume subscription in Stripe if requested
    if (options?.pauseSubscription) {
      const supabase = await createServerClient();
      const { data: subscription } = await supabase
        .from("app_subscriptions")
        .select("stripe_subscription_id, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.stripe_subscription_id) {
        try {
          if (isBlocked) {
            await stripe.subscriptions.update(subscription.stripe_subscription_id, {
              pause_collection: {
                behavior: "keep_as_draft",
              },
            });
          } else {
            await stripe.subscriptions.update(subscription.stripe_subscription_id, {
              pause_collection: null,
            });
          }
        } catch (error) {
          // Log but don't fail - user is still blocked in database
          logger.error("[AdminService] Error updating subscription in Stripe:", error);
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
        logger.error("[AdminService] Error deleting Stripe coupon after failed insert:", delError);
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
        logger.error("[AdminService] Error updating Stripe coupon:", error);
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
        logger.error("[AdminService] Error deleting Stripe coupon:", error);
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

  // NOTE: All group-related methods have been removed. Groups are no longer part of the system.
  // Categories now have a direct type property ("income" | "expense") instead of being grouped.

  /**
   * Get all system categories
   */
  async getAllSystemCategories(): Promise<SystemCategory[]> {
    return this.repository.getAllSystemCategories();
  }

  /**
   * Create a system category
   */
  async createSystemCategory(data: { name: string; type: "income" | "expense" }): Promise<SystemCategory> {
    // Check if system category with this name already exists for this type
    const existing = await this.repository.getAllSystemCategories();
    if (existing.some(c => c.name === data.name && c.type === data.type)) {
      throw new AppError("A system category with this name already exists for this type", 400);
    }

    const id = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const category = await this.repository.createSystemCategory({
      id,
      name: data.name,
      type: data.type,
    });

    // Invalidate cache for all users

    return category;
  }

  /**
   * Update a system category
   */
  async updateSystemCategory(id: string, data: { name?: string; type?: "income" | "expense" }): Promise<SystemCategory> {
    // Verify it's a system category
    const existing = await this.repository.getAllSystemCategories();
    const category = existing.find(c => c.id === id);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    // Check for duplicate name
    if (data.name) {
      const targetType = data.type || category.type;
      if (existing.some(c => c.id !== id && c.name === data.name && c.type === targetType)) {
        throw new AppError("A system category with this name already exists for this type", 400);
      }
    }

    const updated = await this.repository.updateSystemCategory(id, data);

    // Invalidate cache for all users

    return updated;
  }

  /**
   * Delete a system category
   */
  async deleteSystemCategory(id: string): Promise<void> {
    await this.repository.deleteSystemCategory(id);

    // Invalidate cache for all users
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

    return updated;
  }

  /**
   * Delete a system subcategory
   */
  async deleteSystemSubcategory(id: string): Promise<void> {
    await this.repository.deleteSystemSubcategory(id);

    // Invalidate cache for all users
  }

  /**
   * Get system settings
   */
  async getSystemSettings(): Promise<{ maintenanceMode: boolean; seoSettings?: SEOSettings }> {
    return this.repository.getSystemSettings();
  }

  /**
   * Get public system settings (no authentication required)
   */
  async getPublicSystemSettings(): Promise<{ maintenanceMode: boolean }> {
    const settings = await this.repository.getSystemSettings();
    return {
      maintenanceMode: settings.maintenanceMode || false,
    };
  }

  /**
   * Get public SEO settings (no authentication required)
   */
  async getPublicSeoSettings(): Promise<any> {
    const settings = await this.repository.getSystemSettings();
    if (!settings.seoSettings) {
      return this.getDefaultSeoSettings();
    }
    return settings.seoSettings;
  }

  /**
   * Get default SEO settings
   */
  private getDefaultSeoSettings() {
    return {
      title: "Spare Finance - Powerful Tools for Easy Money Management",
      titleTemplate: "%s | Spare Finance",
      description: "Take control of your finances with Spare Finance. Track expenses, manage budgets, set savings goals, and build wealth together with your household. Start your 30-day free trial today.",
      keywords: [
        "personal finance",
        "expense tracking",
        "budget management",
        "financial planning",
        "money management",
        "household finance",
        "savings goals",
        "investment tracking",
        "debt management",
        "financial dashboard",
        "budget app",
        "finance software",
        "money tracker",
        "expense manager",
      ],
      author: "Spare Finance",
      publisher: "Spare Finance",
      openGraph: {
        title: "Spare Finance - Powerful Tools for Easy Money Management",
        description: "Take control of your finances with Spare Finance. Track expenses, manage budgets, set savings goals, and build wealth together with your household.",
        image: "/og-image.png",
        imageWidth: 1200,
        imageHeight: 630,
        imageAlt: "Spare Finance - Personal Finance Management Platform",
      },
      twitter: {
        card: "summary_large_image",
        title: "Spare Finance - Powerful Tools for Easy Money Management",
        description: "Take control of your finances with Spare Finance. Track expenses, manage budgets, set savings goals, and build wealth together.",
        image: "/og-image.png",
        creator: "@sparefinance",
      },
      organization: {
        name: "Spare Finance",
        logo: "/icon-512x512.png",
        url: process.env.NEXT_PUBLIC_APP_URL || "https://app.sparefinance.com",
        socialLinks: {
          twitter: "",
          linkedin: "",
          facebook: "",
          instagram: "",
        },
      },
      application: {
        name: "Spare Finance",
        description: "Take control of your finances with Spare Finance. Track expenses, manage budgets, set savings goals, and build wealth together with your household.",
        category: "FinanceApplication",
        operatingSystem: "Web",
        price: "0",
        priceCurrency: "USD",
        offersUrl: "/pricing",
      },
      googleTagId: "",
    };
  }

  /**
   * Update system settings
   */
  async updateSystemSettings(data: { maintenanceMode?: boolean; seoSettings?: SEOSettings }): Promise<{ maintenanceMode: boolean; seoSettings?: SEOSettings }> {
    return this.repository.updateSystemSettings(data);
  }

  /**
   * Get SEO settings
   */
  async getSEOSettings(): Promise<SEOSettings> {
    const settings = await this.repository.getSystemSettings();
    return settings.seoSettings || this.getDefaultSeoSettings();
  }

  /**
   * Update SEO settings
   */
  async updateSEOSettings(seoSettings: SEOSettings): Promise<SEOSettings> {
    if (!seoSettings.title || !seoSettings.description) {
      throw new AppError("Title and description are required", 400);
    }

    const currentSettings = await this.repository.getSystemSettings();
    const updatedSettings = await this.repository.updateSystemSettings({
      ...currentSettings,
      seoSettings,
    });

    return updatedSettings.seoSettings || seoSettings;
  }

  /**
   * Get all plans
   * Maps from database snake_case to domain camelCase
   */
  async getAllPlans(): Promise<Array<{
    id: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
    features: {
      hasHousehold: boolean;
      maxTransactions: number;
      maxAccounts: number;
      hasInvestments: boolean;
      hasAdvancedReports: boolean;
      hasCsvExport: boolean;
      hasCsvImport: boolean;
      hasDebts: boolean;
      hasGoals: boolean;
      hasBankIntegration: boolean;
      hasBudgets: boolean;
      hasReceiptScanner: boolean;
    };
    stripePriceIdMonthly: string | null;
    stripePriceIdYearly: string | null;
    stripeProductId: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  }>> {
    const plans = await this.repository.getAllPlans();
    
    // Map from database format (snake_case) to domain format (camelCase)
    // Use SubscriptionsMapper to ensure consistency
    const { SubscriptionsMapper } = await import("@/src/application/subscriptions/subscriptions.mapper");
    
    const mappedPlans = plans.map((plan: {
      id: string;
      name: string;
      price_monthly: number | string;
      price_yearly: number | string;
      features: Record<string, unknown>;
      stripe_price_id_monthly: string | null;
      stripe_price_id_yearly: string | null;
      stripe_product_id: string | null;
      created_at: string;
      updated_at: string;
    }) => {
      // Convert to PlanRow format (snake_case)
      const planRow = {
        id: plan.id,
        name: plan.name,
        price_monthly: typeof plan.price_monthly === 'string' ? parseFloat(plan.price_monthly) : plan.price_monthly,
        price_yearly: typeof plan.price_yearly === 'string' ? parseFloat(plan.price_yearly) : plan.price_yearly,
        features: plan.features,
        stripe_price_id_monthly: plan.stripe_price_id_monthly,
        stripe_price_id_yearly: plan.stripe_price_id_yearly,
        stripe_product_id: plan.stripe_product_id,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
      };
      
      // Map to domain format (camelCase)
      return SubscriptionsMapper.planToDomain(planRow);
    });
    
    // BasePlan and Plan are structurally identical (BasePlanFeatures === PlanFeatures)
    // Return as the expected type (features are already validated by normalizeAndValidateFeatures)
    return mappedPlans;
  }

  /**
   * Update a plan
   */
  async updatePlan(
    planId: string,
    data: {
      name?: string;
      features?: Record<string, unknown>;
      priceMonthly?: number;
      priceYearly?: number;
    }
  ): Promise<{ plan: any; stripeSync: { success: boolean; warnings?: string[]; error?: string } }> {
    // Validate features if provided
    if (data.features) {
      const { validateFeaturesForSave } = await import("../shared/plan-features-service");
      validateFeaturesForSave(data.features);
    }

    // Update plan in database
    const updatedPlanRow = await this.repository.updatePlan(planId, data);

    // Map from database format (snake_case) to domain format (camelCase)
    const { SubscriptionsMapper } = await import("@/src/application/subscriptions/subscriptions.mapper");
    
    // Convert to PlanRow format (snake_case)
    const planRow = {
      id: updatedPlanRow.id,
      name: updatedPlanRow.name,
      price_monthly: typeof updatedPlanRow.price_monthly === 'string' ? parseFloat(updatedPlanRow.price_monthly) : updatedPlanRow.price_monthly,
      price_yearly: typeof updatedPlanRow.price_yearly === 'string' ? parseFloat(updatedPlanRow.price_yearly) : updatedPlanRow.price_yearly,
      features: updatedPlanRow.features,
      stripe_price_id_monthly: updatedPlanRow.stripe_price_id_monthly,
      stripe_price_id_yearly: updatedPlanRow.stripe_price_id_yearly,
      stripe_product_id: updatedPlanRow.stripe_product_id,
      created_at: updatedPlanRow.created_at,
      updated_at: updatedPlanRow.updated_at,
    };
    
    // Map to domain format (camelCase)
    const updatedPlan = SubscriptionsMapper.planToDomain(planRow);

    // Invalidate plans cache
    const { makeSubscriptionsService } = await import("../subscriptions/subscriptions.factory");
    const subscriptionsService = makeSubscriptionsService();

    // Invalidate subscription cache for all users with this plan
    // Note: This method doesn't exist yet - can be implemented if needed
    // await subscriptionsService.invalidateSubscriptionsForPlan(planId);

    // Sync to Stripe if plan has stripeProductId
    let stripeSync: { success: boolean; warnings?: string[]; error?: string } = { success: true };
    if (updatedPlan.stripeProductId) {
      try {
        const { makeStripeService } = await import("../stripe/stripe.factory");
        const stripeService = makeStripeService();
        const syncResult = await stripeService.syncPlanToStripe(planId);
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
        .filter((sub) => sub.stripe_subscription_id)
        .map((sub) =>
          stripe.subscriptions.retrieve(sub.stripe_subscription_id!).then(
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
      const stripeSub = sub.stripe_subscription_id
        ? stripeSubMap.get(sub.id)
        : null;

      if (stripeSub) {
        const priceId = stripeSub.items.data[0]?.price.id;

        if (priceId === plan.stripe_price_id_monthly) {
          interval = "month";
          monthlyRevenue = Number(plan.price_monthly) || 0;
        } else if (priceId === plan.stripe_price_id_yearly) {
          interval = "year";
          // Convert yearly to monthly for MRR
          monthlyRevenue = (Number(plan.price_yearly) || 0) / 12;
        } else {
          // Fallback: assume monthly if we can't determine
          interval = "month";
          monthlyRevenue = Number(plan.price_monthly) || 0;
        }
      } else {
        // No Stripe subscription ID or failed to fetch, assume monthly
        interval = "month";
        monthlyRevenue = Number(plan.price_monthly) || 0;
      }

      mrr += monthlyRevenue;

      subscriptionDetails.push({
        subscriptionId: sub.id,
        userId: sub.user_id,
        planId: sub.plan_id,
        planName: plan.name,
        status: sub.status,
        monthlyRevenue,
        interval,
        trialEndDate: sub.trial_end_date,
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
      if (!plan || !sub.trial_end_date) continue;

      const trialEnd = new Date(sub.trial_end_date);
      const daysUntilEnd = Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only count trials that haven't ended
      if (daysUntilEnd > 0) {
        // Assume they'll convert to monthly plan
        const estimatedMonthlyRevenue = Number(plan.price_monthly) || 0;
        estimatedFutureMRR += estimatedMonthlyRevenue;

        upcomingTrials.push({
          subscriptionId: sub.id,
          userId: sub.user_id,
          planId: sub.plan_id,
          planName: plan.name,
          trialEndDate: sub.trial_end_date,
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
      if (plan && planDistribution[sub.plan_id]) {
        planDistribution[sub.plan_id].totalCount++;
        if (sub.status === "active") {
          planDistribution[sub.plan_id].activeCount++;
        } else if (sub.status === "trialing") {
          planDistribution[sub.plan_id].trialingCount++;
        }
      }
    });

    // Calculate users without subscription
    const usersWithSubscription = new Set(
      subscriptionsList.map((sub) => sub.user_id)
    );
    const usersWithoutSubscription =
      (totalUsers || 0) - usersWithSubscription.size;

    // Calculate churn risk (subscriptions that will cancel at period end)
    const churnRisk = activeSubscriptions.filter(
      (sub) => sub.cancel_at_period_end === true
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

  /**
   * Get all subscriptions with their plans
   */
  async getAllSubscriptions(): Promise<any[]> {
    const data = await this.repository.getDashboardRawData();
    
    // Transform the data to handle plan as array or object
    return (data.subscriptions || []).map((sub: any) => ({
      id: sub.id,
      userId: sub.user_id,
      planId: sub.plan_id,
      status: sub.status,
      trialStartDate: sub.trial_start_date,
      trialEndDate: sub.trial_end_date,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      stripeSubscriptionId: sub.stripe_subscription_id,
      plan: Array.isArray(sub.plan) ? sub.plan[0] : sub.plan,
    }));
  }

  /**
   * Get all user service subscriptions
   */
  async getAllUserSubscriptions(): Promise<any[]> {
    const supabase = createServiceRoleClient();

    // Get all user service subscriptions
    const { data: subscriptions, error } = await supabase
      .from("user_subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[AdminService] Error fetching user subscriptions:", error);
      throw new AppError(`Failed to fetch user subscriptions: ${error.message}`, 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return [];
    }

    // Collect all unique IDs for batch fetching
    const userIds = new Set<string>();
    const accountIds = new Set<string>();
    const subcategoryIds = new Set<string>();
    const serviceNames = new Set<string>();

    subscriptions.forEach((sub: any) => {
      if (sub.user_id) userIds.add(sub.user_id);
      if (sub.account_id) accountIds.add(sub.account_id);
      if (sub.subcategory_id) subcategoryIds.add(sub.subcategory_id);
      if (sub.service_name) serviceNames.add(sub.service_name);
    });

    // Batch fetch all related data in parallel
    const [users, accounts, subcategories, services] = await Promise.all([
      userIds.size > 0
        ? this.authRepository.findUsersByIds(Array.from(userIds))
        : Promise.resolve([]),
      accountIds.size > 0
        ? this.accountsRepository.findByIds(Array.from(accountIds))
        : Promise.resolve([]),
      subcategoryIds.size > 0
        ? this.categoriesRepository.findSubcategoriesByIds(Array.from(subcategoryIds))
        : Promise.resolve([]),
      serviceNames.size > 0
        ? this.subscriptionServicesRepository.findServicesByNames(Array.from(serviceNames))
        : Promise.resolve([]),
    ]);

    // Create maps for O(1) lookup
    const usersMap = new Map(users.map((u: any) => [u.id, u]));
    const accountsMap = new Map(accounts.map((a: any) => [a.id, a]));
    const subcategoriesMap = new Map(subcategories.map((s: any) => [s.id, s]));
    const servicesMap = new Map(services.map((s: any) => [s.name, s]));

    // Enrich subscriptions with related data
    return subscriptions.map((sub: any) => ({
      ...sub,
      amount: Number(sub.amount),
      User: sub.user_id ? (usersMap.get(sub.user_id) || null) : null,
      Account: sub.account_id ? (accountsMap.get(sub.account_id) || null) : null,
      Subcategory: sub.subcategory_id ? (subcategoriesMap.get(sub.subcategory_id) || null) : null,
      serviceLogo: servicesMap.get(sub.service_name)?.logo || null,
    }));
  }

  /**
   * Get all subscription services (admin - includes inactive)
   */
  async getAllSubscriptionServices(): Promise<{
    categories: any[];
    services: any[];
  }> {
    const supabase = createServiceRoleClient();

    // Get all categories
    const { data: categories, error: categoriesError } = await supabase
      .from("external_service_categories")
      .select("*")
      .order("display_order", { ascending: true });

    if (categoriesError) {
      logger.error("[AdminService] Error fetching categories:", categoriesError);
      throw new AppError(`Failed to fetch categories: ${categoriesError.message}`, 500);
    }

    // Get all services (sorted alphabetically by name)
    const { data: services, error: servicesError } = await supabase
      .from("external_services")
      .select("*")
      .order("name", { ascending: true });

    if (servicesError) {
      logger.error("[AdminService] Error fetching services:", servicesError);
      throw new AppError(`Failed to fetch services: ${servicesError.message}`, 500);
    }

    // Group services by category
    const servicesByCategory = new Map<string, typeof services>();
    (services || []).forEach((service: any) => {
      if (!servicesByCategory.has(service.category_id)) {
        servicesByCategory.set(service.category_id, []);
      }
      servicesByCategory.get(service.category_id)!.push(service);
    });

    // Enrich categories with their services
    const enrichedCategories = (categories || []).map((category: any) => ({
      ...category,
      services: servicesByCategory.get(category.id) || [],
    }));

    return {
      categories: enrichedCategories,
      services: services || [],
    };
  }

  /**
   * Create a subscription service category
   */
  async createSubscriptionServiceCategory(data: {
    name: string;
    displayOrder?: number;
    isActive?: boolean;
  }): Promise<any> {
    const id = `cat_${data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    return this.repository.createSubscriptionServiceCategory({
      id,
      name: data.name,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
    });
  }

  /**
   * Update a subscription service category
   */
  async updateSubscriptionServiceCategory(id: string, data: {
    name?: string;
    displayOrder?: number;
    isActive?: boolean;
  }): Promise<any> {
    return this.repository.updateSubscriptionServiceCategory(id, data);
  }

  /**
   * Delete a subscription service category
   */
  async deleteSubscriptionServiceCategory(id: string): Promise<void> {
    return this.repository.deleteSubscriptionServiceCategory(id);
  }

  /**
   * Create a subscription service
   */
  async createSubscriptionService(data: {
    categoryId: string;
    name: string;
    logo?: string | null;
    isActive?: boolean;
  }): Promise<any> {
    if (!data.categoryId || !data.name) {
      throw new AppError("Category ID and service name are required", 400);
    }

    const id = `svc_${data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    return this.repository.createSubscriptionService({
      id,
      categoryId: data.categoryId,
      name: data.name,
      logo: data.logo,
      isActive: data.isActive ?? true,
    });
  }

  /**
   * Update a subscription service
   */
  async updateSubscriptionService(id: string, data: {
    categoryId?: string;
    name?: string;
    logo?: string | null;
    isActive?: boolean;
  }): Promise<any> {
    if (!id) {
      throw new AppError("Service ID is required", 400);
    }
    return this.repository.updateSubscriptionService(id, data);
  }

  /**
   * Delete a subscription service
   */
  async deleteSubscriptionService(id: string): Promise<void> {
    if (!id) {
      throw new AppError("Service ID is required", 400);
    }
    return this.repository.deleteSubscriptionService(id);
  }

  /**
   * Get all plans for a subscription service
   */
  async getAllSubscriptionServicePlans(serviceId: string): Promise<any[]> {
    if (!serviceId) {
      throw new AppError("Service ID is required", 400);
    }
    return this.repository.getAllSubscriptionServicePlans(serviceId);
  }

  /**
   * Create a subscription service plan
   */
  async createSubscriptionServicePlan(data: {
    serviceId: string;
    planName: string;
    price: number;
    currency: string;
    isActive?: boolean;
  }): Promise<any> {
    if (!data.serviceId || !data.planName || data.price === undefined || !data.currency) {
      throw new AppError("Service ID, plan name, price, and currency are required", 400);
    }

    if (data.currency !== "USD" && data.currency !== "CAD") {
      throw new AppError("Currency must be USD or CAD", 400);
    }

    if (data.price < 0) {
      throw new AppError("Price must be greater than or equal to 0", 400);
    }

    const id = `plan_${data.serviceId}_${data.planName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    return this.repository.createSubscriptionServicePlan({
      id,
      serviceId: data.serviceId,
      planName: data.planName,
      price: data.price,
      currency: data.currency,
      isActive: data.isActive ?? true,
    });
  }

  /**
   * Update a subscription service plan
   */
  async updateSubscriptionServicePlan(id: string, data: {
    planName?: string;
    price?: number;
    currency?: string;
    isActive?: boolean;
  }): Promise<any> {
    if (!id) {
      throw new AppError("Plan ID is required", 400);
    }

    if (data.currency && data.currency !== "USD" && data.currency !== "CAD") {
      throw new AppError("Currency must be USD or CAD", 400);
    }

    if (data.price !== undefined && data.price < 0) {
      throw new AppError("Price must be greater than or equal to 0", 400);
    }

    return this.repository.updateSubscriptionServicePlan(id, data);
  }

  /**
   * Delete a subscription service plan
   */
  async deleteSubscriptionServicePlan(id: string): Promise<void> {
    if (!id) {
      throw new AppError("Plan ID is required", 400);
    }
    return this.repository.deleteSubscriptionServicePlan(id);
  }

  /**
   * Upload image to Supabase Storage
   */
  async uploadImage(data: {
    file: File;
    folder: string;
    bucket: string;
  }): Promise<{ url: string }> {
    const { validateImageFile, sanitizeFilename, getFileExtension } = await import("@/lib/utils/file-validation");
    
    // Convert File to ArrayBuffer for validation
    const arrayBuffer = await data.file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate image file
    const validation = await validateImageFile(data.file, buffer);
    if (!validation.valid) {
      throw new AppError(validation.error || "Invalid file", 400);
    }

    // Sanitize filename
    const sanitizedOriginalName = sanitizeFilename(data.file.name);
    const fileExt = getFileExtension(sanitizedOriginalName) || getFileExtension(data.file.name) || "png";
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = data.folder ? `${data.folder}/${timestamp}-${randomSuffix}.${fileExt}` : `${timestamp}-${randomSuffix}.${fileExt}`;

    return this.repository.uploadImage({
      file: buffer,
      fileName,
      contentType: data.file.type,
      bucket: data.bucket,
    });
  }

  /**
   * End trial immediately or cancel subscription
   */
  async endTrialOrCancel(subscriptionId: string, action: "end_trial" | "cancel"): Promise<{ success: boolean; message: string; subscription: any; warning?: string; stripeSubscriptionId: string; userId: string }> {
    if (!subscriptionId || !action) {
      throw new AppError("subscriptionId and action are required. Action must be 'end_trial' or 'cancel'", 400);
    }

    if (action !== "end_trial" && action !== "cancel") {
      throw new AppError("Action must be 'end_trial' or 'cancel'", 400);
    }

    const result = await this.repository.endTrialOrCancel(subscriptionId, action);

    // Update in Stripe
    try {
      if (action === "cancel") {
        // Cancel subscription immediately in Stripe
        await stripe.subscriptions.cancel(result.stripeSubscriptionId);
        logger.log("[AdminService] Subscription cancelled in Stripe");
      } else {
        // End trial immediately by setting trial_end to now
        const now = Math.floor(Date.now() / 1000); // Unix timestamp
        await stripe.subscriptions.update(result.stripeSubscriptionId, {
          trial_end: now,
        });
        logger.log("[AdminService] Trial ended in Stripe");
      }
    } catch (stripeError) {
      logger.error("[AdminService] Error updating subscription in Stripe:", stripeError);
      return {
        success: result.success,
        message: result.message,
        subscription: result.subscription,
        warning: `Updated in database but failed to sync with Stripe: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`,
        stripeSubscriptionId: result.stripeSubscriptionId,
        userId: result.userId,
      };
    }

    // Invalidate cache
    if (result.userId) {
      const { makeSubscriptionsService } = await import("../subscriptions/subscriptions.factory");
      const subscriptionsService = makeSubscriptionsService();
    }

    return result;
  }

  /**
   * Update subscription trial end date
   */
  async updateSubscriptionTrial(subscriptionId: string, trialEndDate: Date): Promise<{ success: boolean; message: string; subscription: any; warning?: string; stripeSubscriptionId: string; userId: string }> {
    if (!subscriptionId || !trialEndDate) {
      throw new AppError("subscriptionId and trialEndDate are required", 400);
    }

    // Validate that trialEndDate is in the future
    const now = new Date();
    if (trialEndDate <= now) {
      throw new AppError("Trial end date must be in the future", 400);
    }

    const result = await this.repository.updateSubscriptionTrial(subscriptionId, trialEndDate);

    // Update in Stripe
    try {
      const { makeStripeService } = await import("../stripe/stripe.factory");
      const stripeService = makeStripeService();
      const stripeResult = await stripeService.updateSubscriptionTrial(result.userId, trialEndDate);

      if (!stripeResult.success) {
        logger.error("[AdminService] Error updating subscription in Stripe:", stripeResult.error);
        return {
          ...result,
          warning: `Updated in database but failed to sync with Stripe: ${stripeResult.error}`,
        };
      }
    } catch (error) {
      logger.error("[AdminService] Error updating subscription in Stripe:", error);
      return {
        ...result,
        warning: `Updated in database but failed to sync with Stripe: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    return result;
  }

  /**
   * Cancel subscription with various options
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelOption: "immediately" | "end_of_period" | "specific_date",
    cancelAt?: Date,
    refundOption?: string
  ): Promise<{ success: boolean; message: string; subscription: any; warning?: string; stripeSubscriptionId: string; userId: string }> {
    if (!subscriptionId || !cancelOption) {
      throw new AppError("subscriptionId and cancelOption are required", 400);
    }

    if (!["immediately", "end_of_period", "specific_date"].includes(cancelOption)) {
      throw new AppError("cancelOption must be 'immediately', 'end_of_period', or 'specific_date'", 400);
    }

    if (cancelOption === "specific_date" && !cancelAt) {
      throw new AppError("cancelAt is required when cancelOption is 'specific_date'", 400);
    }

    const result = await this.repository.cancelSubscription(subscriptionId, cancelOption, cancelAt);

    // Update in Stripe
    try {
      if (cancelOption === "immediately") {
        // Cancel immediately
        await stripe.subscriptions.cancel(result.stripeSubscriptionId);
        logger.log("[AdminService] Subscription cancelled immediately in Stripe");
      } else {
        // Update subscription with cancel settings
        const stripeUpdate: any = {};
        if (cancelOption === "end_of_period") {
          stripeUpdate.cancel_at_period_end = true;
        } else if (cancelOption === "specific_date" && cancelAt) {
          const cancelTimestamp = Math.floor(cancelAt.getTime() / 1000);
          stripeUpdate.cancel_at = cancelTimestamp;
        }

        await stripe.subscriptions.update(result.stripeSubscriptionId, stripeUpdate);
        logger.log("[AdminService] Subscription updated in Stripe:", stripeUpdate);
      }
    } catch (stripeError) {
      logger.error("[AdminService] Error updating subscription in Stripe:", stripeError);
      return {
        success: result.success,
        message: result.message,
        subscription: result.subscription,
        warning: `Updated in database but failed to sync with Stripe: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`,
        stripeSubscriptionId: result.stripeSubscriptionId,
        userId: result.userId,
      };
    }

    // Invalidate cache
    if (result.userId) {
      const { makeSubscriptionsService } = await import("../subscriptions/subscriptions.factory");
      const subscriptionsService = makeSubscriptionsService();
    }

    return result;
  }
}

