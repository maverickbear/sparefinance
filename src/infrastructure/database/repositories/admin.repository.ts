/**
 * Admin Repository
 * Data access layer for admin operations
 */

import { createServerClient, createServiceRoleClient } from "../supabase-server";
import { AdminUser, PromoCode, SystemGroup, SystemCategory, SystemSubcategory } from "../../../domain/admin/admin.types";
import { logger } from "@/src/infrastructure/utils/logger";

export class AdminRepository {
  /**
   * Check if user is super_admin
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const supabase = await createServerClient();
    const { data: userData } = await supabase
      .from("User")
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
      .from("User")
      .select("id, email, name, createdAt, isBlocked")
      .order("createdAt", { ascending: false });

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
      .from("Subscription")
      .select("id, userId, planId, status, trialEndDate, trialStartDate, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd")
      .in("userId", userIds)
      .order("createdAt", { ascending: false });

    // Get all plans
    const { data: plans } = await supabase
      .from("Plan")
      .select("id, name");

    const planMap = new Map((plans || []).map((p) => [p.id, p]));
    
    // Create subscription map (most recent per user)
    const subscriptionMap = new Map<string, any>();
    (subscriptions || []).forEach((s) => {
      if (!subscriptionMap.has(s.userId)) {
        subscriptionMap.set(s.userId, s);
      }
    });

    // Get household information
    const { data: ownedHouseholds } = await supabase
      .from("Household")
      .select("id, createdBy, type")
      .in("createdBy", userIds);

    const allOwnedHouseholdIds = (ownedHouseholds || []).map(h => h.id);
    
    const { data: householdMembers } = await supabase
      .from("HouseholdMemberNew")
      .select("userId, householdId, status, email, name, Household(createdBy, type)")
      .in("status", ["active", "pending"])
      .or(
        userIds.length > 0 && allOwnedHouseholdIds.length > 0
          ? `userId.in.(${userIds.join(',')}),householdId.in.(${allOwnedHouseholdIds.join(',')})`
          : userIds.length > 0
          ? `userId.in.(${userIds.join(',')})`
          : allOwnedHouseholdIds.length > 0
          ? `householdId.in.(${allOwnedHouseholdIds.join(',')})`
          : "id.eq.null"
      );

    // Build household info map (simplified version)
    const householdInfoMap = new Map<string, { hasHousehold: boolean; isOwner: boolean; memberCount: number; householdId: string | null; ownerId: string | null }>();
    
    userIds.forEach((userId) => {
      const ownedHousehold = (ownedHouseholds || []).find((h) => h.createdBy === userId);
      const isOwner = !!ownedHousehold;
      
      const memberHousehold = (householdMembers || []).find((hm: any) => {
        const household = hm.Household as any;
        return hm.userId === userId && 
               hm.status === "active" && 
               household?.createdBy !== userId;
      });
      const isMember = !!memberHousehold;
      
      let householdId: string | null = null;
      let ownerId: string | null = null;
      
      if (isOwner && ownedHousehold) {
        householdId = ownedHousehold.id;
        ownerId = userId;
      } else if (isMember && memberHousehold) {
        householdId = memberHousehold.householdId;
        const household = memberHousehold.Household as any;
        ownerId = household?.createdBy || null;
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
      const plan = subscription ? planMap.get(subscription.planId) : null;
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
        createdAt: new Date(user.createdAt),
        isBlocked: user.isBlocked || false,
        plan: plan ? { id: plan.id, name: plan.name } : null,
        subscription: subscription ? {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.planId,
          trialEndDate: subscription.trialEndDate || null,
          trialStartDate: subscription.trialStartDate || null,
          stripeSubscriptionId: subscription.stripeSubscriptionId || null,
          currentPeriodEnd: subscription.currentPeriodEnd || null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        } : null,
        household,
      };
    });
  }

  /**
   * Block or unblock a user
   */
  async blockUser(userId: string, isBlocked: boolean, reason?: string, blockedBy?: string): Promise<void> {
    const supabase = createServiceRoleClient();

    const { error: updateError } = await supabase
      .from("User")
      .update({
        isBlocked,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      logger.error("[AdminRepository] Error blocking user:", updateError);
      throw new Error(`Failed to block user: ${updateError.message}`);
    }

    // Save to block history if blocking
    if (isBlocked && reason && blockedBy) {
      await supabase
        .from("UserBlockHistory")
        .insert({
          userId,
          action: "block",
          reason: reason.trim(),
          blockedBy,
        });
    }
  }

  /**
   * Get all promo codes
   */
  async getAllPromoCodes(): Promise<PromoCode[]> {
    const supabase = await createServerClient();

    const { data: promoCodes, error } = await supabase
      .from("PromoCode")
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) {
      logger.error("[AdminRepository] Error fetching promo codes:", error);
      throw new Error(`Failed to fetch promo codes: ${error.message}`);
    }

    return (promoCodes || []).map((pc) => ({
      id: pc.id,
      code: pc.code,
      discountType: pc.discountType,
      discountValue: parseFloat(pc.discountValue),
      duration: pc.duration,
      durationInMonths: pc.durationInMonths,
      maxRedemptions: pc.maxRedemptions,
      expiresAt: pc.expiresAt ? new Date(pc.expiresAt) : null,
      isActive: pc.isActive,
      stripeCouponId: pc.stripeCouponId,
      planIds: (pc.planIds || []) as string[],
      createdAt: new Date(pc.createdAt),
      updatedAt: new Date(pc.updatedAt),
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
    const supabase = await createServerClient();

    const { data: promoCode, error } = await supabase
      .from("PromoCode")
      .insert({
        id: data.id,
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        discountValue: data.discountValue,
        duration: data.duration,
        durationInMonths: data.durationInMonths || null,
        maxRedemptions: data.maxRedemptions || null,
        expiresAt: data.expiresAt?.toISOString() || null,
        isActive: data.isActive,
        stripeCouponId: data.stripeCouponId,
        planIds: data.planIds || [],
      })
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error creating promo code:", error);
      throw new Error(`Failed to create promo code: ${error.message}`);
    }

    return {
      id: promoCode.id,
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue: parseFloat(promoCode.discountValue),
      duration: promoCode.duration,
      durationInMonths: promoCode.durationInMonths,
      maxRedemptions: promoCode.maxRedemptions,
      expiresAt: promoCode.expiresAt ? new Date(promoCode.expiresAt) : null,
      isActive: promoCode.isActive,
      stripeCouponId: promoCode.stripeCouponId,
      planIds: (promoCode.planIds || []) as string[],
      createdAt: new Date(promoCode.createdAt),
      updatedAt: new Date(promoCode.updatedAt),
    };
  }

  /**
   * Update a promo code
   */
  async updatePromoCode(id: string, data: Partial<PromoCode>): Promise<PromoCode> {
    const supabase = await createServerClient();

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.discountValue !== undefined) updateData.discountValue = data.discountValue;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.durationInMonths !== undefined) updateData.durationInMonths = data.durationInMonths;
    if (data.maxRedemptions !== undefined) updateData.maxRedemptions = data.maxRedemptions;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt?.toISOString() || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.planIds !== undefined) updateData.planIds = data.planIds;

    const { data: promoCode, error } = await supabase
      .from("PromoCode")
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
      discountType: promoCode.discountType,
      discountValue: parseFloat(promoCode.discountValue),
      duration: promoCode.duration,
      durationInMonths: promoCode.durationInMonths,
      maxRedemptions: promoCode.maxRedemptions,
      expiresAt: promoCode.expiresAt ? new Date(promoCode.expiresAt) : null,
      isActive: promoCode.isActive,
      stripeCouponId: promoCode.stripeCouponId,
      planIds: (promoCode.planIds || []) as string[],
      createdAt: new Date(promoCode.createdAt),
      updatedAt: new Date(promoCode.updatedAt),
    };
  }

  /**
   * Delete a promo code
   */
  async deletePromoCode(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("PromoCode")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[AdminRepository] Error deleting promo code:", error);
      throw new Error(`Failed to delete promo code: ${error.message}`);
    }
  }

  /**
   * Get all system groups
   */
  async getAllSystemGroups(): Promise<SystemGroup[]> {
    const supabase = await createServerClient();

    const { data: groups, error } = await supabase
      .from("Group")
      .select("*")
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      logger.error("[AdminRepository] Error fetching system groups:", error);
      throw new Error(`Failed to fetch system groups: ${error.message}`);
    }

    return (groups || []).map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type as "income" | "expense" | null,
      createdAt: new Date(g.createdAt),
      updatedAt: new Date(g.updatedAt),
      userId: null,
    }));
  }

  /**
   * Create a system group
   */
  async createSystemGroup(data: { id: string; name: string; type?: "income" | "expense" }): Promise<SystemGroup> {
    const supabase = await createServerClient();

    const now = new Date().toISOString();
    const { data: group, error } = await supabase
      .from("Group")
      .insert({
        id: data.id,
        name: data.name,
        type: data.type || "expense",
        userId: null,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error creating system group:", error);
      throw new Error(`Failed to create system group: ${error.message}`);
    }

    return {
      id: group.id,
      name: group.name,
      type: group.type as "income" | "expense" | null,
      createdAt: new Date(group.createdAt),
      updatedAt: new Date(group.updatedAt),
      userId: null,
    };
  }

  /**
   * Update a system group
   */
  async updateSystemGroup(id: string, data: { name?: string; type?: "income" | "expense" }): Promise<SystemGroup> {
    const supabase = await createServerClient();

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;

    const { data: group, error } = await supabase
      .from("Group")
      .update(updateData)
      .eq("id", id)
      .is("userId", null)
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating system group:", error);
      throw new Error(`Failed to update system group: ${error.message}`);
    }

    return {
      id: group.id,
      name: group.name,
      type: group.type as "income" | "expense" | null,
      createdAt: new Date(group.createdAt),
      updatedAt: new Date(group.updatedAt),
      userId: null,
    };
  }

  /**
   * Delete a system group
   */
  async deleteSystemGroup(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Group")
      .delete()
      .eq("id", id)
      .is("userId", null);

    if (error) {
      logger.error("[AdminRepository] Error deleting system group:", error);
      throw new Error(`Failed to delete system group: ${error.message}`);
    }
  }

  /**
   * Get all system categories
   */
  async getAllSystemCategories(): Promise<SystemCategory[]> {
    const supabase = await createServerClient();

    const { data: categories, error } = await supabase
      .from("Category")
      .select(`
        *,
        group:Group(*),
        subcategories:Subcategory(*)
      `)
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      logger.error("[AdminRepository] Error fetching system categories:", error);
      throw new Error(`Failed to fetch system categories: ${error.message}`);
    }

    return (categories || []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      macroId: cat.groupId,
      createdAt: new Date(cat.createdAt),
      updatedAt: new Date(cat.updatedAt),
      userId: null,
      group: cat.group ? {
        id: cat.group.id,
        name: cat.group.name,
        type: (cat.group as any).type ?? null,
        createdAt: new Date(cat.group.createdAt),
        updatedAt: new Date(cat.group.updatedAt),
        userId: null,
      } : undefined,
      subcategories: (cat.subcategories || []).map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.categoryId,
        createdAt: new Date(sub.createdAt),
        updatedAt: new Date(sub.updatedAt),
        userId: null,
        logo: sub.logo || null,
      })),
    }));
  }

  /**
   * Create a system category
   */
  async createSystemCategory(data: { id: string; name: string; macroId: string }): Promise<SystemCategory> {
    const supabase = await createServerClient();

    const now = new Date().toISOString();
    const { data: category, error } = await supabase
      .from("Category")
      .insert({
        id: data.id,
        name: data.name,
        groupId: data.macroId,
        userId: null,
        createdAt: now,
        updatedAt: now,
      })
      .select(`
        *,
        group:Group(*),
        subcategories:Subcategory(*)
      `)
      .single();

    if (error) {
      logger.error("[AdminRepository] Error creating system category:", error);
      throw new Error(`Failed to create system category: ${error.message}`);
    }

    return {
      id: category.id,
      name: category.name,
      macroId: category.groupId,
      createdAt: new Date(category.createdAt),
      updatedAt: new Date(category.updatedAt),
      userId: null,
      group: category.group ? {
        id: category.group.id,
        name: category.group.name,
        type: (category.group as any).type ?? null,
        createdAt: new Date(category.group.createdAt),
        updatedAt: new Date(category.group.updatedAt),
        userId: null,
      } : undefined,
      subcategories: [],
    };
  }

  /**
   * Update a system category
   */
  async updateSystemCategory(id: string, data: { name?: string; macroId?: string }): Promise<SystemCategory> {
    const supabase = await createServerClient();

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.macroId !== undefined) updateData.groupId = data.macroId;

    const { data: category, error } = await supabase
      .from("Category")
      .update(updateData)
      .eq("id", id)
      .is("userId", null)
      .select(`
        *,
        group:Group(*),
        subcategories:Subcategory(*)
      `)
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating system category:", error);
      throw new Error(`Failed to update system category: ${error.message}`);
    }

    return {
      id: category.id,
      name: category.name,
      macroId: category.groupId,
      createdAt: new Date(category.createdAt),
      updatedAt: new Date(category.updatedAt),
      userId: null,
      group: category.group ? {
        id: category.group.id,
        name: category.group.name,
        type: (category.group as any).type ?? null,
        createdAt: new Date(category.group.createdAt),
        updatedAt: new Date(category.group.updatedAt),
        userId: null,
      } : undefined,
      subcategories: (category.subcategories || []).map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.categoryId,
        createdAt: new Date(sub.createdAt),
        updatedAt: new Date(sub.updatedAt),
        userId: null,
        logo: sub.logo || null,
      })),
    };
  }

  /**
   * Delete a system category
   */
  async deleteSystemCategory(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Category")
      .delete()
      .eq("id", id)
      .is("userId", null);

    if (error) {
      logger.error("[AdminRepository] Error deleting system category:", error);
      throw new Error(`Failed to delete system category: ${error.message}`);
    }
  }

  /**
   * Get all system subcategories
   */
  async getAllSystemSubcategories(): Promise<SystemSubcategory[]> {
    const supabase = await createServerClient();

    const { data: subcategories, error } = await supabase
      .from("Subcategory")
      .select("*")
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      logger.error("[AdminRepository] Error fetching system subcategories:", error);
      throw new Error(`Failed to fetch system subcategories: ${error.message}`);
    }

    return (subcategories || []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      categoryId: sub.categoryId,
      createdAt: new Date(sub.createdAt),
      updatedAt: new Date(sub.updatedAt),
      userId: null,
      logo: sub.logo || null,
    }));
  }

  /**
   * Create a system subcategory
   */
  async createSystemSubcategory(data: { id: string; name: string; categoryId: string; logo?: string | null }): Promise<SystemSubcategory> {
    const supabase = await createServerClient();

    const now = new Date().toISOString();
    const { data: subcategory, error } = await supabase
      .from("Subcategory")
      .insert({
        id: data.id,
        name: data.name,
        categoryId: data.categoryId,
        userId: null,
        logo: data.logo || null,
        createdAt: now,
        updatedAt: now,
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
      categoryId: subcategory.categoryId,
      createdAt: new Date(subcategory.createdAt),
      updatedAt: new Date(subcategory.updatedAt),
      userId: null,
      logo: subcategory.logo || null,
    };
  }

  /**
   * Update a system subcategory
   */
  async updateSystemSubcategory(id: string, data: { name?: string; logo?: string | null }): Promise<SystemSubcategory> {
    const supabase = await createServerClient();

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logo !== undefined) updateData.logo = data.logo;

    const { data: subcategory, error } = await supabase
      .from("Subcategory")
      .update(updateData)
      .eq("id", id)
      .is("userId", null)
      .select()
      .single();

    if (error) {
      logger.error("[AdminRepository] Error updating system subcategory:", error);
      throw new Error(`Failed to update system subcategory: ${error.message}`);
    }

    return {
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      createdAt: new Date(subcategory.createdAt),
      updatedAt: new Date(subcategory.updatedAt),
      userId: null,
      logo: subcategory.logo || null,
    };
  }

  /**
   * Delete a system subcategory
   */
  async deleteSystemSubcategory(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Subcategory")
      .delete()
      .eq("id", id)
      .is("userId", null);

    if (error) {
      logger.error("[AdminRepository] Error deleting system subcategory:", error);
      throw new Error(`Failed to delete system subcategory: ${error.message}`);
    }
  }
}

