/**
 * Admin Repository
 * Data access layer for admin operations
 */

import { createServerClient, createServiceRoleClient } from "../supabase-server";
import { AdminUser, PromoCode, SystemCategory, SystemSubcategory } from "../../../domain/admin/admin.types";
import { logger } from "@/src/infrastructure/utils/logger";

// Database row types (snake_case from Supabase)
type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  trial_end_date: string | null;
  trial_start_date: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

type PlanRow = {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, unknown>;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  stripe_product_id: string | null;
  created_at: string;
  updated_at: string;
};

type HouseholdMemberRow = {
  user_id: string;
  household_id: string;
  status: string;
  email: string | null;
  name: string | null;
  household: {
    created_by: string;
    type: string;
  } | null;
};

type SubcategoryRow = {
  id: string;
  name: string;
  category_id: string;
  created_at: string;
  updated_at: string;
  is_system: boolean;
  logo: string | null;
};

type SubscriptionWithPlanRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  trial_start_date: string | null;
  trial_end_date: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  plan: {
    id: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
    stripe_price_id_monthly: string | null;
    stripe_price_id_yearly: string | null;
  } | null;
};

type FeedbackRow = {
  id: string;
  user_id: string;
  rating: number;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  User: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type ContactFormRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  User: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type SubscriptionServiceCategoryRow = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SubscriptionServiceRow = {
  id: string;
  category_id: string;
  name: string;
  logo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SubscriptionServicePlanRow = {
  id: string;
  service_id: string;
  plan_name: string;
  price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PromoCodeUpdateData = {
  updated_at: string;
  code?: string;
  discount_type?: string;
  discount_value?: number;
  duration?: string;
  duration_in_months?: number | null;
  max_redemptions?: number | null;
  expires_at?: string | null;
  is_active?: boolean;
  plan_ids?: string[];
};

type CategoryUpdateData = {
  updated_at: string;
  name?: string;
  type?: string;
};

type SubcategoryUpdateData = {
  updated_at: string;
  name?: string;
  logo?: string | null;
};

type SystemSettingsUpdateData = {
  updated_at: string;
  maintenance_mode?: boolean;
  seo_settings?: Record<string, unknown>;
};

type PlanUpdateData = {
  updated_at: string;
  name?: string;
  features?: Record<string, unknown>;
  price_monthly?: number;
  price_yearly?: number;
};

type ContactFormUpdateData = {
  updated_at: string;
  status?: string;
  admin_notes?: string;
};

type SubscriptionServiceCategoryUpdateData = {
  updated_at: string;
  name?: string;
  display_order?: number;
  is_active?: boolean;
};

type SubscriptionServiceUpdateData = {
  updated_at: string;
  category_id?: string;
  name?: string;
  logo?: string | null;
  is_active?: boolean;
};

type SubscriptionServicePlanUpdateData = {
  updated_at: string;
  plan_name?: string;
  price?: number;
  currency?: string;
  is_active?: boolean;
};

type SeoSettings = Record<string, unknown>;

export class AdminRepository {
  /**
   * Check if user is super_admin
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const supabase = await createServerClient();
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    return userData?.role === "super_admin";
  }

  /**
   * Get all users with subscription and household information
   */
  async getAllUsers(): Promise<AdminUser[]> {
    const supabase = createServiceRoleClient();

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, name, created_at, is_blocked")
      .order("created_at", { ascending: false });

    if (usersError) {
      logger.error("[AdminRepository] Error fetching users:", usersError);
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return [];
    }

    const userIds = users.map((u) => u.id);

    // Get all subscriptions
    const { data: subscriptions } = await supabase
      .from("app_subscriptions")
      .select("id, user_id, plan_id, status, trial_end_date, trial_start_date, stripe_subscription_id, current_period_end, cancel_at_period_end")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });

    // Get all plans
    const { data: plans } = await supabase
      .from("app_plans")
      .select("id, name");

    const planMap = new Map((plans || []).map((p) => [p.id, p]));
    
    // Create subscription map (most recent per user)
    const subscriptionMap = new Map<string, SubscriptionRow>();
    (subscriptions || []).forEach((s) => {
      if (!subscriptionMap.has(s.user_id)) {
        subscriptionMap.set(s.user_id, s);
      }
    });

    // Get household information
    const { data: ownedHouseholds } = await supabase
      .from("households")
      .select("id, created_by, type")
      .in("created_by", userIds);

    const allOwnedHouseholdIds = (ownedHouseholds || []).map(h => h.id);
    
    const { data: householdMembers } = await supabase
      .from("household_members")
      .select("user_id, household_id, status, email, name, household:households(created_by, type)")
      .in("status", ["active", "pending"])
      .or(
        userIds.length > 0 && allOwnedHouseholdIds.length > 0
          ? `user_id.in.(${userIds.join(',')}),household_id.in.(${allOwnedHouseholdIds.join(',')})`
          : userIds.length > 0
          ? `user_id.in.(${userIds.join(',')})`
          : allOwnedHouseholdIds.length > 0
          ? `household_id.in.(${allOwnedHouseholdIds.join(',')})`
          : "id.eq.null"
      );

    // Build household info map (simplified version)
    const householdInfoMap = new Map<string, { hasHousehold: boolean; isOwner: boolean; memberCount: number; householdId: string | null; ownerId: string | null }>();
    
    userIds.forEach((userId) => {
      const ownedHousehold = (ownedHouseholds || []).find((h) => h.created_by === userId);
      const isOwner = !!ownedHousehold;
      
      const memberHousehold = (householdMembers || []).find((hm) => {
        const household = Array.isArray(hm.household) ? hm.household[0] : hm.household;
        return hm.user_id === userId && 
               hm.status === "active" && 
               household?.created_by !== userId;
      }) as HouseholdMemberRow | undefined;
      const isMember = !!memberHousehold;
      
      let householdId: string | null = null;
      let ownerId: string | null = null;
      
      if (isOwner && ownedHousehold) {
        householdId = ownedHousehold.id;
        ownerId = userId;
      } else if (isMember && memberHousehold) {
        householdId = memberHousehold.household_id;
        const household = Array.isArray(memberHousehold.household) ? memberHousehold.household[0] : memberHousehold.household;
        ownerId = household?.created_by || null;
      }
      
      householdInfoMap.set(userId, {
        hasHousehold: isOwner || isMember,
        isOwner,
        memberCount: 0, // Simplified - would need to count members
        householdId,
        ownerId,
      });
    });

    // Map users with their data
    return users.map((user) => {
      const subscription = subscriptionMap.get(user.id);
      // FIX: subscription comes from database in snake_case, use plan_id not planId
      const plan = subscription ? planMap.get(subscription.plan_id) : null;
      const household = householdInfoMap.get(user.id) || {
        hasHousehold: false,
        isOwner: false,
        memberCount: 0,
        householdId: null,
        ownerId: null,
      };

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date(user.created_at),
        isBlocked: user.is_blocked || false,
        plan: plan ? { id: plan.id, name: plan.name } : null,
        subscription: subscription ? {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.plan_id,
          trialEndDate: subscription.trial_end_date || null,
          trialStartDate: subscription.trial_start_date || null,
          stripeSubscriptionId: subscription.stripe_subscription_id || null,
          currentPeriodEnd: subscription.current_period_end || null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        } : null,
        household,
      };
    });
  }

  /**
   * Check if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    return true;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<{ id: string; email: string; isBlocked: boolean } | null> {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, email, is_blocked")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      isBlocked: data.is_blocked || false,
    };
  }

  /**
   * Block or unblock a user
   */
  async blockUser(userId: string, isBlocked: boolean, reason?: string, blockedBy?: string): Promise<void> {
    const supabase = createServiceRoleClient();

    const { error: updateError } = await supabase
      .from("users")
      .update({
        is_blocked: isBlocked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      logger.error("[AdminRepository] Error blocking user:", updateError);
      throw new Error(`Failed to block user: ${updateError.message}`);
    }

    // Save to block history if blocking or unblocking
    if (reason && blockedBy) {
      await supabase
        .from("system_user_block_history")
        .insert({
          user_id: userId,
          action: isBlocked ? "block" : "unblock",
          reason: reason.trim(),
          blocked_by: blockedBy,
        });
    }
  }

  /**
   * Get all promo codes
   */
  async getAllPromoCodes(): Promise<PromoCode[]> {
    // FIX: Use service role client to bypass RLS for admin operations
    const supabase = createServiceRoleClient();

    // FIX: Table name is app_promo_codes, not system_promo_codes
    const { data: promoCodes, error } = await supabase
      .from("app_promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[AdminRepository] Error fetching promo codes:", error);
      throw new Error(`Failed to fetch promo codes: ${error.message}`);
    }

    return (promoCodes || []).map((pc) => ({
      id: pc.id,
      code: pc.code,
      discountType: pc.discount_type,
      discountValue: parseFloat(pc.discount_value),
      duration: pc.duration,
      durationInMonths: pc.duration_in_months,
      maxRedemptions: pc.max_redemptions,
      expiresAt: pc.expires_at ? new Date(pc.expires_at) : null,
      isActive: pc.is_active,
      stripeCouponId: pc.stripe_coupon_id,
      planIds: (pc.plan_ids || []) as string[],
      createdAt: new Date(pc.created_at),
      updatedAt: new Date(pc.updated_at),
    }));
  }

  /**
   * Create a promo code
   */
  async createPromoCode(data: {
    id: string;
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    duration: "once" | "forever" | "repeating";
    durationInMonths?: number | null;
    maxRedemptions?: number | null;
    expiresAt?: Date | null;
    isActive: boolean;
    stripeCouponId: string;
    planIds: string[];
  }): Promise<PromoCode> {
    // FIX: Use service role client to bypass RLS for admin operations
    const supabase = createServiceRoleClient();

    // FIX: Table name is app_promo_codes, not system_promo_codes
    const { data: promoCode, error } = await supabase
      .from("app_promo_codes")
      .insert({
        id: data.id,
        code: data.code.toUpperCase(),
        discount_type: data.discountType,
        discount_value: data.discountValue,
        duration: data.duration,
        duration_in_months: data.durationInMonths || null,
        max_redemptions: data.maxRedemptions || null,
        expires_at: data.expiresAt?.toISOString() || null,
        is_active: data.isActive,
        stripe_coupon_id: data.stripeCouponId,
        plan_ids: data.planIds || [],
      })
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error creating promo code:", error);
      throw new Error(`Failed to create promo code: ${error.message}`);
    }

    // FIX: Database returns snake_case, map to camelCase
    return {
      id: promoCode.id,
      code: promoCode.code,
      discountType: promoCode.discount_type,
      discountValue: typeof promoCode.discount_value === 'string' ? parseFloat(promoCode.discount_value) : promoCode.discount_value,
      duration: promoCode.duration,
      durationInMonths: promoCode.duration_in_months,
      maxRedemptions: promoCode.max_redemptions,
      expiresAt: promoCode.expires_at ? new Date(promoCode.expires_at) : null,
      isActive: promoCode.is_active,
      stripeCouponId: promoCode.stripe_coupon_id,
      planIds: (promoCode.plan_ids || []) as string[],
      createdAt: new Date(promoCode.created_at),
      updatedAt: new Date(promoCode.updated_at),
    };
  }

  /**
   * Update a promo code
   */
  async updatePromoCode(id: string, data: Partial<PromoCode>): Promise<PromoCode> {
    // FIX: Use service role client to bypass RLS for admin operations
    const supabase = createServiceRoleClient();

    const updateData: PromoCodeUpdateData = {
      updated_at: new Date().toISOString(),
    };
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.discountType !== undefined) updateData.discount_type = data.discountType;
    if (data.discountValue !== undefined) updateData.discount_value = data.discountValue;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.durationInMonths !== undefined) updateData.duration_in_months = data.durationInMonths;
    if (data.maxRedemptions !== undefined) updateData.max_redemptions = data.maxRedemptions;
    if (data.expiresAt !== undefined) updateData.expires_at = data.expiresAt?.toISOString() || null;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.planIds !== undefined) updateData.plan_ids = data.planIds;

    // FIX: Table name is app_promo_codes, not system_promo_codes
    const { data: promoCode, error } = await supabase
      .from("app_promo_codes")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating promo code:", error);
      throw new Error(`Failed to update promo code: ${error.message}`);
    }

    return {
      id: promoCode.id,
      code: promoCode.code,
      discountType: promoCode.discount_type,
      discountValue: parseFloat(promoCode.discount_value),
      duration: promoCode.duration,
      durationInMonths: promoCode.duration_in_months,
      maxRedemptions: promoCode.max_redemptions,
      expiresAt: promoCode.expires_at ? new Date(promoCode.expires_at) : null,
      isActive: promoCode.is_active,
      stripeCouponId: promoCode.stripe_coupon_id,
      planIds: (promoCode.plan_ids || []) as string[],
      createdAt: new Date(promoCode.created_at),
      updatedAt: new Date(promoCode.updated_at),
    };
  }

  /**
   * Delete a promo code
   */
  async deletePromoCode(id: string): Promise<void> {
    // FIX: Use service role client to bypass RLS for admin operations
    const supabase = createServiceRoleClient();

    // FIX: Table name is app_promo_codes, not system_promo_codes
    const { error } = await supabase
      .from("app_promo_codes")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[AdminRepository] Error deleting promo code:", error);
      throw new Error(`Failed to delete promo code: ${error.message}`);
    }
  }

  // NOTE: All group-related methods have been completely removed. Groups are no longer part of the system.
  // Categories now have a direct type property ("income" | "expense") instead of being grouped.

  /**
   * Get all system categories
   */
  async getAllSystemCategories(): Promise<SystemCategory[]> {
    const supabase = createServiceRoleClient();

    const { data: categories, error } = await supabase
      .from("categories")
      .select(`
        *,
        subcategories:subcategories(*)
      `)
      .eq("is_system", true)
      .order("name", { ascending: true });

    if (error) {
      logger.error("[AdminRepository] Error fetching system categories:", error);
      throw new Error(`Failed to fetch system categories: ${error.message}`);
    }

    return (categories || []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      type: cat.type as "income" | "expense",
      createdAt: new Date(cat.created_at),
      updatedAt: new Date(cat.updated_at),
      userId: null,
      isSystem: true as const,
      subcategories: (cat.subcategories || [])
        .filter((sub: SubcategoryRow) => sub.is_system === true) // Filter to only system subcategories
        .map((sub: SubcategoryRow) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.category_id,
        createdAt: new Date(sub.created_at),
        updatedAt: new Date(sub.updated_at),
        userId: null,
          isSystem: true as const,
        logo: sub.logo || null,
      })),
    }));
  }

  /**
   * Create a system category
   */
  async createSystemCategory(data: { id: string; name: string; type: "income" | "expense" }): Promise<SystemCategory> {
    const supabase = createServiceRoleClient();

    const now = new Date().toISOString();
    const { data: category, error } = await supabase
      .from("categories")
      .insert({
        id: data.id,
        name: data.name,
        type: data.type,
        user_id: null,
        is_system: true,
        created_at: now,
        updated_at: now,
      })
      .select(`
        *,
        subcategories:subcategories(*)
      `)
      .single();

    if (error) {
      logger.error("[AdminRepository] Error creating system category:", error);
      throw new Error(`Failed to create system category: ${error.message}`);
    }

    return {
      id: category.id,
      name: category.name,
      type: category.type as "income" | "expense",
      createdAt: new Date(category.created_at),
      updatedAt: new Date(category.updated_at),
      userId: null,
      isSystem: true as const,
      subcategories: [],
    };
  }

  /**
   * Update a system category
   */
  async updateSystemCategory(id: string, data: { name?: string; type?: "income" | "expense" }): Promise<SystemCategory> {
    const supabase = createServiceRoleClient();

    const updateData: CategoryUpdateData = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;

    const { data: category, error } = await supabase
      .from("categories")
      .update(updateData)
      .eq("id", id)
      .eq("is_system", true)
      .select(`
        *,
        subcategories:subcategories(*)
      `)
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating system category:", error);
      throw new Error(`Failed to update system category: ${error.message}`);
    }

    return {
      id: category.id,
      name: category.name,
      type: category.type as "income" | "expense",
      createdAt: new Date(category.created_at),
      updatedAt: new Date(category.updated_at),
      userId: null,
      isSystem: true as const,
      subcategories: (category.subcategories || []).map((sub: SubcategoryRow) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.category_id,
        createdAt: new Date(sub.created_at),
        updatedAt: new Date(sub.updated_at),
        userId: null,
        isSystem: true as const,
        logo: sub.logo || null,
      })),
    };
  }

  /**
   * Delete a system category
   */
  async deleteSystemCategory(id: string): Promise<void> {
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("is_system", true);

    if (error) {
      logger.error("[AdminRepository] Error deleting system category:", error);
      throw new Error(`Failed to delete system category: ${error.message}`);
    }
  }

  /**
   * Get all system subcategories
   */
  async getAllSystemSubcategories(): Promise<SystemSubcategory[]> {
    const supabase = createServiceRoleClient();

    const { data: subcategories, error } = await supabase
      .from("subcategories")
      .select("*")
      .eq("is_system", true)
      .order("name", { ascending: true });

    if (error) {
      logger.error("[AdminRepository] Error fetching system subcategories:", error);
      throw new Error(`Failed to fetch system subcategories: ${error.message}`);
    }

    return (subcategories || []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      categoryId: sub.category_id,
      createdAt: new Date(sub.created_at),
      updatedAt: new Date(sub.updated_at),
      userId: null,
      isSystem: true as const,
      logo: sub.logo || null,
    }));
  }

  /**
   * Create a system subcategory
   */
  async createSystemSubcategory(data: { id: string; name: string; categoryId: string; logo?: string | null }): Promise<SystemSubcategory> {
    const supabase = createServiceRoleClient();

    const now = new Date().toISOString();
    const { data: subcategory, error } = await supabase
      .from("subcategories")
      .insert({
        id: data.id,
        name: data.name,
        category_id: data.categoryId,
        user_id: null,
        is_system: true,
        logo: data.logo || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error creating system subcategory:", error);
      throw new Error(`Failed to create system subcategory: ${error.message}`);
    }

    return {
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.category_id,
      createdAt: new Date(subcategory.created_at),
      updatedAt: new Date(subcategory.updated_at),
      userId: null,
      isSystem: true,
      logo: subcategory.logo || null,
    };
  }

  /**
   * Update a system subcategory
   */
  async updateSystemSubcategory(id: string, data: { name?: string; logo?: string | null }): Promise<SystemSubcategory> {
    const supabase = createServiceRoleClient();

    const updateData: SubcategoryUpdateData = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logo !== undefined) updateData.logo = data.logo;

    const { data: subcategory, error } = await supabase
      .from("subcategories")
      .update(updateData)
      .eq("id", id)
      .eq("is_system", true)
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating system subcategory:", error);
      throw new Error(`Failed to update system subcategory: ${error.message}`);
    }

    return {
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.category_id,
      createdAt: new Date(subcategory.created_at),
      updatedAt: new Date(subcategory.updated_at),
      userId: null,
      isSystem: true as const,
      logo: subcategory.logo || null,
    };
  }

  /**
   * Delete a system subcategory
   */
  async deleteSystemSubcategory(id: string): Promise<void> {
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("subcategories")
      .delete()
      .eq("id", id)
      .eq("is_system", true);

    if (error) {
      logger.error("[AdminRepository] Error deleting system subcategory:", error);
      throw new Error(`Failed to delete system subcategory: ${error.message}`);
    }
  }

  /**
   * Get dashboard data (users, subscriptions, plans)
   */
  async getDashboardData(): Promise<{
    totalUsers: number;
    subscriptions: SubscriptionWithPlanRow[];
    plans: PlanRow[];
  }> {
    const supabase = createServiceRoleClient();

    // Get all users count
    const { count: totalUsers, error: usersError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (usersError) {
      logger.error("[AdminRepository] Error fetching users count:", usersError);
      throw new Error(`Failed to fetch users count: ${usersError.message}`);
    }

    // Get all subscriptions with their plans
    const { data: subscriptions, error: subsError } = await supabase
      .from("app_subscriptions")
      .select(`
        id,
        user_id,
        plan_id,
        status,
        trial_start_date,
        trial_end_date,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        stripe_subscription_id,
        plan:app_plans(
          id,
          name,
          price_monthly,
          price_yearly,
          stripe_price_id_monthly,
          stripe_price_id_yearly
        )
      `)
      .order("created_at", { ascending: false });

    if (subsError) {
      logger.error("[AdminRepository] Error fetching subscriptions:", subsError);
      throw new Error(`Failed to fetch subscriptions: ${subsError.message}`);
    }

    // Get all plans
    const { data: plans, error: plansError } = await supabase
      .from("app_plans")
      .select("id, name, price_monthly, price_yearly")
      .order("price_monthly", { ascending: true });

    if (plansError) {
      logger.error("[AdminRepository] Error fetching plans:", plansError);
      throw new Error(`Failed to fetch plans: ${plansError.message}`);
    }

    return {
      totalUsers: totalUsers || 0,
      subscriptions: (subscriptions || []) as unknown as SubscriptionWithPlanRow[],
      plans: (plans || []) as PlanRow[],
    };
  }

  /**
   * Get system settings
   */
  async getSystemSettings(): Promise<{ maintenanceMode: boolean; seoSettings?: SeoSettings }> {
    const supabase = createServiceRoleClient();

    // Use system_settings table
    const { data: settings, error } = await supabase
      .from("system_config_settings")
      .select("*")
      .eq("id", "default")
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" - we'll return default if it doesn't exist
      
      // Check if this is a prerendering error - if so, return default silently
      const errorMessage = error.message || "";
      if (errorMessage.includes("prerender") || 
          errorMessage.includes("HANGING_PROMISE") ||
          errorMessage.includes("fetch() rejects")) {
        // During prerendering, return default settings
        return { maintenanceMode: false };
      }
      
      logger.error("[AdminRepository] Error fetching system settings:", error);
      
      // Check if the error is due to HTML response (misconfigured Supabase URL)
      if (errorMessage.includes("<html>") || 
          errorMessage.includes("500 Internal Server Error") ||
          errorMessage.includes("cloudflare")) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "not set";
        throw new Error(
          `Failed to fetch system settings: Supabase URL appears to be misconfigured. ` +
          `Received HTML error page instead of JSON response. ` +
          `Please verify NEXT_PUBLIC_SUPABASE_URL points to your Supabase project (should end with .supabase.co), ` +
          `not your app domain. Current URL: ${supabaseUrl.substring(0, 50)}...`
        );
      }
      
      throw new Error(`Failed to fetch system settings: ${error.message}`);
    }

    // If no settings exist, return default
    if (!settings) {
      return { maintenanceMode: false };
    }

    return {
      maintenanceMode: settings.maintenance_mode || false,
      seoSettings: settings.seo_settings || undefined,
    };
  }

  /**
   * Update system settings
   */
  async updateSystemSettings(data: { maintenanceMode?: boolean; seoSettings?: SeoSettings }): Promise<{ maintenanceMode: boolean; seoSettings?: SeoSettings }> {
    const supabase = createServiceRoleClient();

    // Try to update existing settings
    const updateData: SystemSettingsUpdateData = {
      updated_at: new Date().toISOString(),
    };
    if (data.maintenanceMode !== undefined) {
      updateData.maintenance_mode = data.maintenanceMode;
    }
    if (data.seoSettings !== undefined) {
      updateData.seo_settings = data.seoSettings;
    }

    // Use system_settings table
    const { data: updatedSettings, error: updateError } = await supabase
      .from("system_config_settings")
      .update(updateData)
      .eq("id", "default")
      .select()
      .single();

    // If update failed because row doesn't exist, create it
    if (updateError && updateError.code === "PGRST116") {
      const { data: newSettings, error: insertError } = await supabase
        .from("system_config_settings")
        .insert({
          id: "default",
          maintenance_mode: data.maintenanceMode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        logger.error("[AdminRepository] Error creating system settings:", insertError);
        throw new Error(`Failed to create system settings: ${insertError.message}`);
      }

      return {
        maintenanceMode: newSettings.maintenance_mode,
      };
    }

    if (updateError) {
      logger.error("[AdminRepository] Error updating system settings:", updateError);
      throw new Error(`Failed to update system settings: ${updateError.message}`);
    }

    return {
      maintenanceMode: updatedSettings?.maintenance_mode || false,
    };
  }

  /**
   * Get all plans
   */
  async getAllPlans(): Promise<PlanRow[]> {
    const supabase = createServiceRoleClient();

    const { data: plans, error } = await supabase
      .from("app_plans")
      .select("*")
      .order("price_monthly", { ascending: true });

    if (error) {
      logger.error("[AdminRepository] Error fetching plans:", error);
      throw new Error(`Failed to fetch plans: ${error.message}`);
    }

    return plans || [];
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
  ): Promise<PlanRow> {
    const supabase = createServiceRoleClient();

    // FIX: Database uses snake_case, not camelCase
    const updateData: PlanUpdateData = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.features !== undefined) updateData.features = data.features;
    if (data.priceMonthly !== undefined) updateData.price_monthly = data.priceMonthly;
    if (data.priceYearly !== undefined) updateData.price_yearly = data.priceYearly;

    const { data: updatedPlan, error } = await supabase
      .from("app_plans")
      .update(updateData)
      .eq("id", planId)
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating plan:", error);
      throw new Error(`Failed to update plan: ${error.message}`);
    }

    if (!updatedPlan) {
      throw new Error("Plan update succeeded but no data returned");
    }

    return updatedPlan;
  }

  /**
   * Get all feedbacks with pagination and metrics
   */
  async getFeedbacks(options?: { limit?: number; offset?: number }): Promise<{
    feedbacks: FeedbackRow[];
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
    const supabase = createServiceRoleClient();
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    // Get feedbacks with user info
    const { data: feedbacks, error: feedbacksError } = await supabase
      .from("system_support_feedback")
      .select(`
        id,
        user_id,
        rating,
        feedback,
        created_at,
        updated_at,
        User:user_id (
          id,
          name,
          email
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (feedbacksError) {
      logger.error("[AdminRepository] Error fetching feedbacks:", feedbacksError);
      throw new Error(`Failed to fetch feedbacks: ${feedbacksError.message}`);
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from("system_support_feedback")
      .select("*", { count: "exact", head: true });

    if (countError) {
      logger.error("[AdminRepository] Error fetching feedback count:", countError);
    }

    // Get all feedbacks for metrics
    const { data: allFeedbacks, error: allFeedbacksError } = await supabase
      .from("system_support_feedback")
      .select("rating");

    if (allFeedbacksError) {
      logger.error("[AdminRepository] Error fetching all feedbacks for metrics:", allFeedbacksError);
    }

    const metrics = {
      total: count || 0,
      averageRating: 0,
      ratingDistribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    };

    if (allFeedbacks && allFeedbacks.length > 0) {
      const totalRating = allFeedbacks.reduce((sum, f) => sum + f.rating, 0);
      metrics.averageRating = totalRating / allFeedbacks.length;

      allFeedbacks.forEach((f) => {
        if (f.rating >= 1 && f.rating <= 5) {
          metrics.ratingDistribution[f.rating as keyof typeof metrics.ratingDistribution]++;
        }
      });
    }

    return {
      feedbacks: (feedbacks || []) as unknown as FeedbackRow[],
      total: count || 0,
      metrics,
    };
  }

  /**
   * Get all contact forms with pagination
   */
  async getContactForms(options?: { status?: string; limit?: number; offset?: number }): Promise<{
    contactForms: ContactFormRow[];
    total: number;
  }> {
    const supabase = createServiceRoleClient();
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    // Build query
    let query = supabase
      .from("system_support_contact_forms")
      .select(`
        id,
        user_id,
        name,
        email,
        subject,
        message,
        status,
        admin_notes,
        created_at,
        updated_at,
        User:user_id (
          id,
          name,
          email
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (options?.status) {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[AdminRepository] Error fetching contact forms:", error);
      throw new Error(`Failed to fetch contact forms: ${error.message}`);
    }

    // Get total count
    let countQuery = supabase.from("system_contact_forms").select("*", { count: "exact", head: true });
    if (options?.status) {
      countQuery = countQuery.eq("status", options.status);
    }
    const { count, error: countError } = await countQuery;

    if (countError) {
      logger.error("[AdminRepository] Error fetching contact form count:", countError);
    }

    return {
      contactForms: (data || []) as unknown as ContactFormRow[],
      total: count || 0,
    };
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
  ): Promise<ContactFormRow> {
    const supabase = createServiceRoleClient();

    const updateData: ContactFormUpdateData = {
      updated_at: new Date().toISOString(),
    };

    if (data.status !== undefined) updateData.status = data.status;
    if (data.adminNotes !== undefined) updateData.admin_notes = data.adminNotes;

    const { data: updatedContactForm, error } = await supabase
      .from("system_support_contact_forms")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating contact form:", error);
      throw new Error(`Failed to update contact form: ${error.message}`);
    }

    if (!updatedContactForm) {
      throw new Error("Contact form update succeeded but no data returned");
    }

    return updatedContactForm;
  }

  /**
   * Get dashboard raw data (users, subscriptions, plans)
   */
  async getDashboardRawData(): Promise<{
    totalUsers: number | null;
    subscriptions: SubscriptionWithPlanRow[];
    plans: PlanRow[];
  }> {
    const supabase = createServiceRoleClient();

    // Get all users count
    const { count: totalUsers, error: usersError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (usersError) {
      logger.error("[AdminRepository] Error fetching users count:", usersError);
    }

    // Get all subscriptions with their plans
    const { data: subscriptions, error: subsError } = await supabase
      .from("app_subscriptions")
      .select(`
        id,
        user_id,
        plan_id,
        status,
        trial_start_date,
        trial_end_date,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        stripe_subscription_id,
        plan:app_plans(
          id,
          name,
          price_monthly,
          price_yearly,
          stripe_price_id_monthly,
          stripe_price_id_yearly
        )
      `)
      .order("created_at", { ascending: false });

    if (subsError) {
      logger.error("[AdminRepository] Error fetching subscriptions:", subsError);
    }

    // Get all plans
    const { data: plans, error: plansError } = await supabase
      .from("app_plans")
      .select("id, name, price_monthly, price_yearly")
      .order("price_monthly", { ascending: true });

    if (plansError) {
      logger.error("[AdminRepository] Error fetching plans:", plansError);
    }

    return {
      totalUsers: totalUsers || null,
      subscriptions: (subscriptions || []) as unknown as SubscriptionWithPlanRow[],
      plans: (plans || []) as PlanRow[],
    };
  }

  /**
   * Create a subscription service category
   */
  async createSubscriptionServiceCategory(data: {
    id: string;
    name: string;
    displayOrder: number;
    isActive: boolean;
  }): Promise<SubscriptionServiceCategoryRow> {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    const { data: category, error } = await supabase
      .from("external_service_categories")
      .insert({
        id: data.id,
        name: data.name.trim(),
        display_order: data.displayOrder,
        is_active: data.isActive,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error creating subscription service category:", error);
      throw new Error(`Failed to create category: ${error.message}`);
    }

    return category;
  }

  /**
   * Update a subscription service category
   */
  async updateSubscriptionServiceCategory(id: string, data: {
    name?: string;
    displayOrder?: number;
    isActive?: boolean;
  }): Promise<SubscriptionServiceCategoryRow> {
    const supabase = createServiceRoleClient();
    const updateData: SubscriptionServiceCategoryUpdateData = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: category, error } = await supabase
      .from("external_service_categories")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating subscription service category:", error);
      throw new Error(`Failed to update category: ${error.message}`);
    }

    return category;
  }

  /**
   * Delete a subscription service category
   */
  async deleteSubscriptionServiceCategory(id: string): Promise<void> {
    const supabase = createServiceRoleClient();

    // Check if category has services
    const { data: services, error: servicesError } = await supabase
      .from("external_services")
      .select("id")
      .eq("category_id", id)
      .limit(1);

    if (servicesError) {
      logger.error("[AdminRepository] Error checking services:", servicesError);
      throw new Error(`Failed to check category services: ${servicesError.message}`);
    }

    if (services && services.length > 0) {
      throw new Error("Cannot delete category with existing services. Delete or move services first.");
    }

    const { error } = await supabase
      .from("external_service_categories")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[AdminRepository] Error deleting subscription service category:", error);
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }

  /**
   * Create a subscription service
   */
  async createSubscriptionService(data: {
    id: string;
    categoryId: string;
    name: string;
    logo?: string | null;
    isActive: boolean;
  }): Promise<SubscriptionServiceRow> {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    const { data: service, error } = await supabase
      .from("external_services")
      .insert({
        id: data.id,
        category_id: data.categoryId,
        name: data.name.trim(),
        logo: data.logo || null,
        is_active: data.isActive,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error creating subscription service:", error);
      throw new Error(`Failed to create service: ${error.message}`);
    }

    return service;
  }

  /**
   * Update a subscription service
   */
  async updateSubscriptionService(id: string, data: {
    categoryId?: string;
    name?: string;
    logo?: string | null;
    isActive?: boolean;
  }): Promise<SubscriptionServiceRow> {
    const supabase = createServiceRoleClient();
    const updateData: SubscriptionServiceUpdateData = {
      updated_at: new Date().toISOString(),
    };

    if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.logo !== undefined) updateData.logo = data.logo || null;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: service, error } = await supabase
      .from("external_services")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating subscription service:", error);
      throw new Error(`Failed to update service: ${error.message}`);
    }

    return service;
  }

  /**
   * Delete a subscription service
   */
  async deleteSubscriptionService(id: string): Promise<void> {
    const supabase = createServiceRoleClient();

    // Get service name to check if it's used in user subscriptions
    const { data: service, error: serviceError } = await supabase
      .from("external_services")
      .select("name")
      .eq("id", id)
      .single();

    if (serviceError) {
      logger.error("[AdminRepository] Error fetching service:", serviceError);
      throw new Error(`Failed to fetch service: ${serviceError.message}`);
    }

    if (service) {
      // Check if service is used in any user subscriptions
      const { error: checkError } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("service_name", service.name)
        .limit(1);

      if (checkError) {
        logger.error("[AdminRepository] Error checking user subscriptions:", checkError);
        // Don't fail, just log
      }

      // Note: This is a simple check. In production, you might want to link UserServiceSubscription to SubscriptionService via a foreign key
    }

    const { error } = await supabase
      .from("external_services")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[AdminRepository] Error deleting subscription service:", error);
      throw new Error(`Failed to delete service: ${error.message}`);
    }
  }

  /**
   * Get all plans for a subscription service
   */
  async getAllSubscriptionServicePlans(serviceId: string): Promise<SubscriptionServicePlanRow[]> {
    const supabase = createServiceRoleClient();

    const { data: plans, error } = await supabase
      .from("subscription_service_plans")
      .select("*")
      .eq("service_id", serviceId)
      .order("plan_name", { ascending: true });

    if (error) {
      logger.error("[AdminRepository] Error fetching subscription service plans:", error);
      throw new Error(`Failed to fetch plans: ${error.message}`);
    }

    return plans || [];
  }

  /**
   * Create a subscription service plan
   */
  async createSubscriptionServicePlan(data: {
    id: string;
    serviceId: string;
    planName: string;
    price: number;
    currency: string;
    isActive: boolean;
  }): Promise<SubscriptionServicePlanRow> {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    const { data: plan, error } = await supabase
      .from("subscription_service_plans")
      .insert({
        id: data.id,
        service_id: data.serviceId,
        plan_name: data.planName.trim(),
        price: parseFloat(data.price.toString()),
        currency: data.currency,
        is_active: data.isActive,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error creating subscription service plan:", error);
      throw new Error(`Failed to create plan: ${error.message}`);
    }

    return plan;
  }

  /**
   * Update a subscription service plan
   */
  async updateSubscriptionServicePlan(id: string, data: {
    planName?: string;
    price?: number;
    currency?: string;
    isActive?: boolean;
  }): Promise<SubscriptionServicePlanRow> {
    const supabase = createServiceRoleClient();
    const updateData: SubscriptionServicePlanUpdateData = {
      updated_at: new Date().toISOString(),
    };

    if (data.planName !== undefined) updateData.plan_name = data.planName.trim();
    if (data.price !== undefined) updateData.price = parseFloat(data.price.toString());
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: plan, error } = await supabase
      .from("subscription_service_plans")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating subscription service plan:", error);
      throw new Error(`Failed to update plan: ${error.message}`);
    }

    return plan;
  }

  /**
   * Delete a subscription service plan
   */
  async deleteSubscriptionServicePlan(id: string): Promise<void> {
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("subscription_service_plans")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[AdminRepository] Error deleting subscription service plan:", error);
      throw new Error(`Failed to delete plan: ${error.message}`);
    }
  }

  /**
   * Upload image to Supabase Storage
   */
  async uploadImage(data: {
    file: Buffer;
    fileName: string;
    contentType: string;
    bucket: string;
  }): Promise<{ url: string }> {
    const { createServiceRoleClient } = await import("../supabase-server");
    const supabase = createServiceRoleClient();

    const { error: uploadError } = await supabase.storage
      .from(data.bucket)
      .upload(data.fileName, data.file, {
        contentType: data.contentType,
        upsert: false,
      });

    if (uploadError) {
      logger.error("[AdminRepository] Error uploading image:", uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(data.bucket)
      .getPublicUrl(data.fileName);

    if (!urlData?.publicUrl) {
      throw new Error("Failed to get image URL");
    }

    return { url: urlData.publicUrl };
  }

  /**
   * End trial immediately or cancel subscription
   */
  async endTrialOrCancel(subscriptionId: string, action: "end_trial" | "cancel"): Promise<{ success: boolean; message: string; subscription: SubscriptionRow; warning?: string; stripeSubscriptionId: string; userId: string }> {
    const supabase = createServiceRoleClient();

    // Get subscription to verify it exists and get userId/stripeSubscriptionId
    const { data: subscription, error: subError } = await supabase
      .from("app_subscriptions")
      .select("id, user_id, stripe_subscription_id, status, trial_end_date")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (subError || !subscription) {
      logger.error("[AdminRepository] Error fetching subscription:", subError);
      throw new Error("Subscription not found");
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error("Subscription does not have a Stripe subscription ID");
    }

    let updatedSubscription;
    const now = new Date().toISOString();

    if (action === "end_trial") {
      if (subscription.status !== "trialing") {
        throw new Error("Subscription is not in trial period");
      }

      // Update in Supabase
      const { data: updated, error: updateError } = await supabase
        .from("app_subscriptions")
        .update({
          trial_end_date: now,
          updated_at: now,
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        logger.error("[AdminRepository] Error updating subscription:", updateError);
        throw new Error(`Failed to update subscription in database: ${updateError.message}`);
      }

      updatedSubscription = updated;
    } else if (action === "cancel") {
      // Update in Supabase
      const { data: updated, error: updateError } = await supabase
        .from("app_subscriptions")
        .update({
          status: "cancelled",
          cancel_at_period_end: false,
          updated_at: now,
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        logger.error("[AdminRepository] Error updating subscription:", updateError);
        throw new Error(`Failed to update subscription in database: ${updateError.message}`);
      }

      updatedSubscription = updated;
    }

    return {
      success: true,
      message: action === "end_trial" ? "Trial ended successfully" : "Subscription cancelled successfully",
      subscription: updatedSubscription,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      userId: subscription.user_id,
    };
  }

  /**
   * Update subscription trial end date
   */
  async updateSubscriptionTrial(subscriptionId: string, trialEndDate: Date): Promise<{ success: boolean; message: string; subscription: SubscriptionRow; warning?: string; stripeSubscriptionId: string; userId: string }> {
    const supabase = createServiceRoleClient();

    // Get subscription to verify it exists and get userId/stripeSubscriptionId
    const { data: subscription, error: subError } = await supabase
      .from("app_subscriptions")
      .select("id, user_id, stripe_subscription_id, status, trial_end_date")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (subError || !subscription) {
      logger.error("[AdminRepository] Error fetching subscription:", subError);
      throw new Error("Subscription not found");
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error("Subscription does not have a Stripe subscription ID");
    }

    // Update in Supabase
    const { data: updatedSub, error: updateError } = await supabase
      .from("app_subscriptions")
      .update({
        trial_end_date: trialEndDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId)
      .select()
      .single();

    if (updateError) {
      logger.error("[AdminRepository] Error updating subscription:", updateError);
      throw new Error(`Failed to update subscription in database: ${updateError.message}`);
    }

    return {
      success: true,
      message: "Trial end date updated successfully in both Supabase and Stripe",
      subscription: updatedSub,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      userId: subscription.user_id,
    };
  }

  /**
   * Cancel subscription with various options
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelOption: "immediately" | "end_of_period" | "specific_date",
    cancelAt?: Date
  ): Promise<{ success: boolean; message: string; subscription: SubscriptionRow; warning?: string; stripeSubscriptionId: string; userId: string; cancelOption: string; cancelAt?: string }> {
    const supabase = createServiceRoleClient();

    // Get subscription
    const { data: subscription, error: subError } = await supabase
      .from("app_subscriptions")
      .select("id, user_id, stripe_subscription_id, status, current_period_end")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (subError || !subscription) {
      logger.error("[AdminRepository] Error fetching subscription:", subError);
      throw new Error("Subscription not found");
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error("Subscription does not have a Stripe subscription ID");
    }

    let updatedSubscription;
    const now = new Date().toISOString();

    if (cancelOption === "immediately") {
      // Update in Supabase
      const { data: updated, error: updateError } = await supabase
        .from("app_subscriptions")
        .update({
          status: "cancelled",
          cancel_at_period_end: false,
          updated_at: now,
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        logger.error("[AdminRepository] Error updating subscription:", updateError);
        throw new Error(`Failed to update subscription in database: ${updateError.message}`);
      }

      updatedSubscription = updated;
    } else if (cancelOption === "end_of_period") {
      // Update in Supabase
      const { data: updated, error: updateError } = await supabase
        .from("app_subscriptions")
        .update({
          cancel_at_period_end: true,
          updated_at: now,
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        logger.error("[AdminRepository] Error updating subscription:", updateError);
        throw new Error(`Failed to update subscription in database: ${updateError.message}`);
      }

      updatedSubscription = updated;
    } else if (cancelOption === "specific_date") {
      if (!cancelAt) {
        throw new Error("cancelAt is required when cancelOption is 'specific_date'");
      }

      // Update in Supabase
      const { data: updated, error: updateError } = await supabase
        .from("app_subscriptions")
        .update({
          cancel_at_period_end: false,
          updated_at: now,
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        logger.error("[AdminRepository] Error updating subscription:", updateError);
        throw new Error(`Failed to update subscription in database: ${updateError.message}`);
      }

      updatedSubscription = updated;
    }

    return {
      success: true,
      message: "Subscription cancellation processed successfully",
      subscription: updatedSubscription,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      userId: subscription.user_id,
      cancelOption,
      cancelAt: cancelAt?.toISOString(),
    };
  }
}

