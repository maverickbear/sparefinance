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

// Helper function to invalidate all categories cache
async function invalidateAllCategoriesCache(): Promise<void> {
  const service = makeCategoriesService();
  await service.invalidateAllCategoriesCache();
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
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
      throw new Error("A system group with this name already exists");
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
      throw new Error("Group not found");
    }

    // Check for duplicate name if updating name
    if (data.name && existing.some(g => g.id !== id && g.name === data.name)) {
      throw new Error("A system group with this name already exists");
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
      throw new Error("Group not found");
    }

    // Check if system category with this name already exists in this group
    const existing = await this.repository.getAllSystemCategories();
    if (existing.some(c => c.name === data.name && c.macroId === data.macroId)) {
      throw new Error("A system category with this name already exists in this macro");
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
      throw new Error("Category not found");
    }

    // Verify new group is a system group if macroId is being updated
    if (data.macroId) {
      const groups = await this.repository.getAllSystemGroups();
      if (!groups.some(g => g.id === data.macroId)) {
        throw new Error("Group not found");
      }
    }

    // Check for duplicate name
    if (data.name) {
      const targetMacroId = data.macroId || category.macroId;
      if (existing.some(c => c.id !== id && c.name === data.name && c.macroId === targetMacroId)) {
        throw new Error("A system category with this name already exists in this group");
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
      throw new Error("Category not found");
    }

    // Check if system subcategory with this name already exists in this category
    const existing = await this.repository.getAllSystemSubcategories();
    if (existing.some(s => s.name === data.name && s.categoryId === data.categoryId)) {
      throw new Error("A system subcategory with this name already exists in this category");
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
      throw new Error("Subcategory not found");
    }

    // Check for duplicate name
    if (data.name && existing.some(s => s.id !== id && s.name === data.name && s.categoryId === subcategory.categoryId)) {
      throw new Error("A system subcategory with this name already exists in this category");
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
}

