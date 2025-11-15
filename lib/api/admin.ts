"use server";

import { createServerClient } from "@/lib/supabase-server";
import { invalidateAllCategoriesCache } from "@/lib/api/categories";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  plan: {
    id: string;
    name: string;
  } | null;
  subscription: {
    id: string;
    status: string;
    planId: string;
  } | null;
  household: {
    hasHousehold: boolean;
    isOwner: boolean;
    memberCount: number;
  };
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  duration: "once" | "forever" | "repeating";
  durationInMonths: number | null;
  maxRedemptions: number | null;
  expiresAt: Date | null;
  isActive: boolean;
  stripeCouponId: string | null;
  planIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Check if current user is super_admin
 */
async function isSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return false;
    }

    const { data: userData } = await supabase
      .from("User")
      .select("role")
      .eq("id", user.id)
      .single();

    return userData?.role === "super_admin";
  } catch (error) {
    console.error("Error checking super_admin status:", error);
    return false;
  }
}

/**
 * Get all users with their subscription and household information
 */
export async function getAllUsers(): Promise<AdminUser[]> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("User")
      .select("id, email, name, createdAt")
      .order("createdAt", { ascending: false });

    if (usersError) {
      throw usersError;
    }

    if (!users || users.length === 0) {
      return [];
    }

    const userIds = users.map((u) => u.id);

    // Get all subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from("Subscription")
      .select("id, userId, planId, status")
      .in("userId", userIds)
      .eq("status", "active")
      .order("createdAt", { ascending: false });

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
    }

    // Get all plans
    const { data: plans, error: plansError } = await supabase
      .from("Plan")
      .select("id, name");

    if (plansError) {
      console.error("Error fetching plans:", plansError);
    }

    const planMap = new Map((plans || []).map((p) => [p.id, p]));
    const subscriptionMap = new Map(
      (subscriptions || []).map((s) => [s.userId, s])
    );

    // Get household information for all users
    // First get all household members where user is owner or member
    const { data: householdMembersOwner, error: householdError1 } = await supabase
      .from("HouseholdMember")
      .select("ownerId, memberId, status")
      .in("ownerId", userIds);

    const { data: householdMembersMember, error: householdError2 } = await supabase
      .from("HouseholdMember")
      .select("ownerId, memberId, status")
      .in("memberId", userIds);

    const householdMembers = [
      ...(householdMembersOwner || []),
      ...(householdMembersMember || []),
    ];

    if (householdError1 || householdError2) {
      console.error("Error fetching household members:", householdError1 || householdError2);
    }

    // Build household info map
    const householdInfoMap = new Map<string, { hasHousehold: boolean; isOwner: boolean; memberCount: number }>();
    
    // Count members per owner
    const ownerMemberCounts = new Map<string, number>();
    (householdMembers || []).forEach((hm) => {
      if (hm.ownerId && hm.status === "active") {
        ownerMemberCounts.set(hm.ownerId, (ownerMemberCounts.get(hm.ownerId) || 0) + 1);
      }
    });

    // Check if user is owner or member
    userIds.forEach((userId) => {
      const isOwner = ownerMemberCounts.has(userId);
      const isMember = (householdMembers || []).some(
        (hm) => hm.memberId === userId && hm.status === "active"
      );
      
      householdInfoMap.set(userId, {
        hasHousehold: isOwner || isMember,
        isOwner,
        memberCount: isOwner ? (ownerMemberCounts.get(userId) || 0) : 0,
      });
    });

    // Map users with their data
    const adminUsers: AdminUser[] = users.map((user) => {
      const subscription = subscriptionMap.get(user.id);
      const plan = subscription ? planMap.get(subscription.planId) : null;
      const household = householdInfoMap.get(user.id) || {
        hasHousehold: false,
        isOwner: false,
        memberCount: 0,
      };

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date(user.createdAt),
        plan: plan
          ? {
              id: plan.id,
              name: plan.name,
            }
          : null,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              planId: subscription.planId,
            }
          : null,
        household,
      };
    });

    return adminUsers;
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    throw error;
  }
}

/**
 * Get all promo codes
 */
export async function getAllPromoCodes(): Promise<PromoCode[]> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    const { data: promoCodes, error } = await supabase
      .from("PromoCode")
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) {
      throw error;
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
  } catch (error) {
    console.error("Error in getAllPromoCodes:", error);
    throw error;
  }
}

/**
 * Create a promo code and corresponding Stripe coupon
 */
export async function createPromoCode(data: {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  duration: "once" | "forever" | "repeating";
  durationInMonths?: number;
  maxRedemptions?: number;
  expiresAt?: Date;
  planIds?: string[];
}): Promise<PromoCode> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Create Stripe coupon
    const stripeCouponParams: Stripe.CouponCreateParams = {
      id: data.code.toUpperCase(),
      name: data.code,
    };

    if (data.discountType === "percent") {
      stripeCouponParams.percent_off = data.discountValue;
    } else {
      stripeCouponParams.amount_off = Math.round(data.discountValue * 100); // Convert to cents
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
    const { data: promoCode, error } = await supabase
      .from("PromoCode")
      .insert({
        id: promoCodeId,
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        discountValue: data.discountValue,
        duration: data.duration,
        durationInMonths: data.durationInMonths || null,
        maxRedemptions: data.maxRedemptions || null,
        expiresAt: data.expiresAt?.toISOString() || null,
        isActive: true,
        stripeCouponId: stripeCoupon.id,
        planIds: data.planIds || [],
      })
      .select()
      .single();

    if (error) {
      // If database insert fails, try to delete the Stripe coupon
      try {
        await stripe.coupons.del(stripeCoupon.id);
      } catch (delError) {
        console.error("Error deleting Stripe coupon after failed insert:", delError);
      }
      throw error;
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
  } catch (error) {
    console.error("Error in createPromoCode:", error);
    throw error;
  }
}

/**
 * Update a promo code and corresponding Stripe coupon
 */
export async function updatePromoCode(
  id: string,
  data: {
    code?: string;
    discountType?: "percent" | "fixed";
    discountValue?: number;
    duration?: "once" | "forever" | "repeating";
    durationInMonths?: number;
    maxRedemptions?: number;
    expiresAt?: Date;
    isActive?: boolean;
    planIds?: string[];
  }
): Promise<PromoCode> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Get existing promo code
    const { data: existing, error: fetchError } = await supabase
      .from("PromoCode")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      throw new Error("Promo code not found");
    }

    // Update Stripe coupon if needed
    if (existing.stripeCouponId && (data.isActive !== undefined || data.expiresAt !== undefined)) {
      try {
        if (data.isActive === false) {
          // Delete coupon in Stripe (can't update, only delete and recreate)
          await stripe.coupons.del(existing.stripeCouponId);
        }
      } catch (stripeError) {
        console.error("Error updating Stripe coupon:", stripeError);
      }
    }

    // Update in database
    const updateData: any = {};
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
      throw error;
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
  } catch (error) {
    console.error("Error in updatePromoCode:", error);
    throw error;
  }
}

/**
 * Delete a promo code and corresponding Stripe coupon
 */
export async function deletePromoCode(id: string): Promise<void> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Get existing promo code to get Stripe coupon ID
    const { data: existing, error: fetchError } = await supabase
      .from("PromoCode")
      .select("stripeCouponId")
      .eq("id", id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Delete from Stripe if exists
    if (existing?.stripeCouponId) {
      try {
        await stripe.coupons.del(existing.stripeCouponId);
      } catch (stripeError) {
        console.error("Error deleting Stripe coupon:", stripeError);
        // Continue with database deletion even if Stripe deletion fails
      }
    }

    // Delete from database
    const { error } = await supabase.from("PromoCode").delete().eq("id", id);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error in deletePromoCode:", error);
    throw error;
  }
}

/**
 * Toggle promo code active status
 */
export async function togglePromoCodeActive(id: string, isActive: boolean): Promise<PromoCode> {
  return updatePromoCode(id, { isActive });
}

// ============================================
// System Groups, Categories, and Subcategories Management
// ============================================

export interface SystemGroup {
  id: string;
  name: string;
  type: "income" | "expense" | null;
  createdAt: Date;
  updatedAt: Date;
  userId: null;
}

export interface SystemCategory {
  id: string;
  name: string;
  macroId: string;
  createdAt: Date;
  updatedAt: Date;
  userId: null;
  group?: SystemGroup;
  subcategories?: SystemSubcategory[];
}

export interface SystemSubcategory {
  id: string;
  name: string;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  userId: null;
  logo: string | null;
}

/**
 * Get all system groups (userId IS NULL)
 */
export async function getAllSystemGroups(): Promise<SystemGroup[]> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    const { data: groups, error } = await supabase
      .from("Group")
      .select("*")
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (groups || []).map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type as "income" | "expense" | null,
      createdAt: new Date(g.createdAt),
      updatedAt: new Date(g.updatedAt),
      userId: null,
    }));
  } catch (error) {
    console.error("Error in getAllSystemGroups:", error);
    throw error;
  }
}

/**
 * Create a system group (userId IS NULL)
 */
export async function createSystemGroup(data: { name: string; type?: "income" | "expense" }): Promise<SystemGroup> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Check if system group with this name already exists
    const { data: existing, error: checkError } = await supabase
      .from("Group")
      .select("id")
      .eq("name", data.name)
      .is("userId", null)
      .single();

    if (existing && !checkError) {
      throw new Error("A system group with this name already exists");
    }

    const id = `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const { data: group, error } = await supabase
      .from("Group")
      .insert({
        id,
        name: data.name,
        type: data.type || "expense", // Default to expense if not provided
        userId: null, // System group
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Invalidate cache for all users since system group was created
    await invalidateAllCategoriesCache();

    return {
      id: group.id,
      name: group.name,
      type: group.type as "income" | "expense" | null,
      createdAt: new Date(group.createdAt),
      updatedAt: new Date(group.updatedAt),
      userId: null,
    };
  } catch (error) {
    console.error("Error in createSystemGroup:", error);
    throw error;
  }
}

/**
 * Update a system group
 */
export async function updateSystemGroup(id: string, data: { name?: string; type?: "income" | "expense" }): Promise<SystemGroup> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Verify it's a system group
    const { data: existing, error: checkError } = await supabase
      .from("Group")
      .select("id, userId")
      .eq("id", id)
      .single();

    if (checkError || !existing) {
      throw new Error("Group not found");
    }

    if (existing.userId !== null) {
      throw new Error("Cannot update user-created groups. Only system groups can be updated.");
    }

    // Check if another system group with this name exists
    if (data.name) {
      const { data: duplicate, error: dupError } = await supabase
        .from("Group")
        .select("id")
        .eq("name", data.name)
        .is("userId", null)
        .neq("id", id)
        .single();

      if (duplicate && !dupError) {
        throw new Error("A system group with this name already exists");
      }
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    const { data: group, error } = await supabase
      .from("Group")
      .update(updateData)
      .eq("id", id)
      .is("userId", null)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Invalidate cache for all users since system group was updated
    await invalidateAllCategoriesCache();

    return {
      id: group.id,
      name: group.name,
      type: group.type as "income" | "expense" | null,
      createdAt: new Date(group.createdAt),
      updatedAt: new Date(group.updatedAt),
      userId: null,
    };
  } catch (error) {
    console.error("Error in updateSystemGroup:", error);
    throw error;
  }
}

/**
 * Delete a system group (will cascade delete categories and subcategories)
 */
export async function deleteSystemGroup(id: string): Promise<void> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Verify it's a system group
    const { data: existing, error: checkError } = await supabase
      .from("Group")
      .select("id, userId")
      .eq("id", id)
      .single();

    if (checkError || !existing) {
      throw new Error("Group not found");
    }

    if (existing.userId !== null) {
      throw new Error("Cannot delete user-created groups. Only system groups can be deleted.");
    }

    // Delete group (categories will be cascade deleted)
    const { error } = await supabase
      .from("Group")
      .delete()
      .eq("id", id)
      .is("userId", null);

    if (error) {
      throw error;
    }

    // Invalidate cache for all users since system group was deleted
    await invalidateAllCategoriesCache();
  } catch (error) {
    console.error("Error in deleteSystemGroup:", error);
    throw error;
  }
}

/**
 * Get all system categories (userId IS NULL)
 */
export async function getAllSystemCategories(): Promise<SystemCategory[]> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
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
      throw error;
    }

    return (categories || []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      macroId: cat.macroId,
      createdAt: new Date(cat.createdAt),
      updatedAt: new Date(cat.updatedAt),
      userId: null,
      group: cat.group
        ? {
            id: cat.group.id,
            name: cat.group.name,
            createdAt: new Date(cat.group.createdAt),
            updatedAt: new Date(cat.group.updatedAt),
            userId: null,
          }
        : undefined,
      subcategories: (cat.subcategories || []).map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.categoryId,
        createdAt: new Date(sub.createdAt),
        updatedAt: new Date(sub.updatedAt),
        userId: null,
      })),
    }));
  } catch (error) {
    console.error("Error in getAllSystemCategories:", error);
    throw error;
  }
}

/**
 * Create a system category (userId IS NULL)
 */
export async function createSystemCategory(data: { name: string; macroId: string }): Promise<SystemCategory> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Verify group is a system group
    const { data: group, error: groupError } = await supabase
      .from("Group")
      .select("id, userId")
      .eq("id", data.macroId)
      .single();

    if (groupError || !group) {
      throw new Error("Group not found");
    }

    if (group.userId !== null) {
      throw new Error("Cannot create system category under user-created group");
    }

    // Check if system category with this name already exists in this group
    const { data: existing, error: checkError } = await supabase
      .from("Category")
      .select("id")
      .eq("name", data.name)
      .eq("macroId", data.macroId)
      .is("userId", null)
      .single();

    if (existing && !checkError) {
      throw new Error("A system category with this name already exists in this macro");
    }

    const id = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const { data: category, error } = await supabase
      .from("Category")
      .insert({
        id,
        name: data.name,
        macroId: data.macroId,
        userId: null, // System category
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
      throw error;
    }

    // Invalidate cache for all users since system category was created
    await invalidateAllCategoriesCache();

    return {
      id: category.id,
      name: category.name,
      macroId: category.macroId,
      createdAt: new Date(category.createdAt),
      updatedAt: new Date(category.updatedAt),
      userId: null,
      group: category.group
        ? {
            id: category.group.id,
            name: category.group.name,
            createdAt: new Date(category.group.createdAt),
            updatedAt: new Date(category.group.updatedAt),
            userId: null,
          }
        : undefined,
      subcategories: [],
    };
  } catch (error) {
    console.error("Error in createSystemCategory:", error);
    throw error;
  }
}

/**
 * Update a system category
 */
export async function updateSystemCategory(
  id: string,
  data: { name?: string; macroId?: string }
): Promise<SystemCategory> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Verify it's a system category
    const { data: existing, error: checkError } = await supabase
      .from("Category")
      .select("id, userId, macroId")
      .eq("id", id)
      .single();

    if (checkError || !existing) {
      throw new Error("Category not found");
    }

    if (existing.userId !== null) {
      throw new Error("Cannot update user-created categories. Only system categories can be updated.");
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) {
      // Check if another system category with this name exists in the same macro
      const { data: duplicate, error: dupError } = await supabase
        .from("Category")
        .select("id")
        .eq("name", data.name)
        .eq("macroId", existing.macroId)
        .is("userId", null)
        .neq("id", id)
        .single();

      if (duplicate && !dupError) {
        throw new Error("A system category with this name already exists in this group");
      }
      updateData.name = data.name;
    }

    if (data.macroId !== undefined) {
      // Verify new group is a system group
      const { data: group, error: groupError } = await supabase
        .from("Group")
        .select("id, userId")
        .eq("id", data.macroId)
        .single();

      if (groupError || !group) {
        throw new Error("Group not found");
      }

      if (group.userId !== null) {
        throw new Error("Cannot move system category to user-created group");
      }

      // Check if another system category with this name exists in the new group
      if (data.name) {
        const { data: duplicate, error: dupError } = await supabase
          .from("Category")
          .select("id")
          .eq("name", data.name)
          .eq("macroId", data.macroId)
          .is("userId", null)
          .neq("id", id)
          .single();

        if (duplicate && !dupError) {
          throw new Error("A system category with this name already exists in the target macro");
        }
      }

      updateData.macroId = data.macroId;
    }

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
      throw error;
    }

    // Invalidate cache for all users since system category was updated
    await invalidateAllCategoriesCache();

    return {
      id: category.id,
      name: category.name,
      macroId: category.macroId,
      createdAt: new Date(category.createdAt),
      updatedAt: new Date(category.updatedAt),
      userId: null,
      group: category.group
        ? {
            id: category.group.id,
            name: category.group.name,
            createdAt: new Date(category.group.createdAt),
            updatedAt: new Date(category.group.updatedAt),
            userId: null,
          }
        : undefined,
      subcategories: (category.subcategories || []).map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.categoryId,
        createdAt: new Date(sub.createdAt),
        updatedAt: new Date(sub.updatedAt),
        userId: null,
      })),
    };
  } catch (error) {
    console.error("Error in updateSystemCategory:", error);
    throw error;
  }
}

/**
 * Delete a system category (will cascade delete subcategories)
 */
export async function deleteSystemCategory(id: string): Promise<void> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Verify it's a system category
    const { data: existing, error: checkError } = await supabase
      .from("Category")
      .select("id, userId")
      .eq("id", id)
      .single();

    if (checkError || !existing) {
      throw new Error("Category not found");
    }

    if (existing.userId !== null) {
      throw new Error("Cannot delete user-created categories. Only system categories can be deleted.");
    }

    // Delete category (subcategories will be cascade deleted)
    const { error } = await supabase
      .from("Category")
      .delete()
      .eq("id", id)
      .is("userId", null);

    if (error) {
      throw error;
    }

    // Invalidate cache for all users since system category was deleted
    await invalidateAllCategoriesCache();
  } catch (error) {
    console.error("Error in deleteSystemCategory:", error);
    throw error;
  }
}

/**
 * Get all system subcategories (userId IS NULL)
 */
export async function getAllSystemSubcategories(): Promise<SystemSubcategory[]> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    const { data: subcategories, error } = await supabase
      .from("Subcategory")
      .select("*")
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      throw error;
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
  } catch (error) {
    console.error("Error in getAllSystemSubcategories:", error);
    throw error;
  }
}

/**
 * Get system subcategories by category
 */
export async function getSystemSubcategoriesByCategory(categoryId: string): Promise<SystemSubcategory[]> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Verify category is a system category
    const { data: category, error: categoryError } = await supabase
      .from("Category")
      .select("id, userId")
      .eq("id", categoryId)
      .single();

    if (categoryError || !category) {
      throw new Error("Category not found");
    }

    if (category.userId !== null) {
      throw new Error("Category is not a system category");
    }

    const { data: subcategories, error } = await supabase
      .from("Subcategory")
      .select("*")
      .eq("categoryId", categoryId)
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      throw error;
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
  } catch (error) {
    console.error("Error in getSystemSubcategoriesByCategory:", error);
    throw error;
  }
}

/**
 * Create a system subcategory (userId IS NULL)
 */
export async function createSystemSubcategory(data: { name: string; categoryId: string; logo?: string | null }): Promise<SystemSubcategory> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Verify category is a system category
    const { data: category, error: categoryError } = await supabase
      .from("Category")
      .select("id, userId")
      .eq("id", data.categoryId)
      .single();

    if (categoryError || !category) {
      throw new Error("Category not found");
    }

    if (category.userId !== null) {
      throw new Error("Cannot create system subcategory under user-created category");
    }

    // Check if system subcategory with this name already exists in this category
    const { data: existing, error: checkError } = await supabase
      .from("Subcategory")
      .select("id")
      .eq("name", data.name)
      .eq("categoryId", data.categoryId)
      .is("userId", null)
      .single();

    if (existing && !checkError) {
      throw new Error("A system subcategory with this name already exists in this category");
    }

    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const { data: subcategory, error } = await supabase
      .from("Subcategory")
      .insert({
        id,
        name: data.name,
        categoryId: data.categoryId,
        userId: null, // System subcategory
        logo: data.logo || null,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Invalidate cache for all users since system subcategory was created
    await invalidateAllCategoriesCache();

    return {
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      createdAt: new Date(subcategory.createdAt),
      updatedAt: new Date(subcategory.updatedAt),
      userId: null,
      logo: subcategory.logo || null,
    };
  } catch (error) {
    console.error("Error in createSystemSubcategory:", error);
    throw error;
  }
}

/**
 * Update a system subcategory
 */
export async function updateSystemSubcategory(id: string, data: { name?: string; logo?: string | null }): Promise<SystemSubcategory> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Verify it's a system subcategory
    const { data: existing, error: checkError } = await supabase
      .from("Subcategory")
      .select("id, userId, categoryId")
      .eq("id", id)
      .single();

    if (checkError || !existing) {
      throw new Error("Subcategory not found");
    }

    if (existing.userId !== null) {
      throw new Error("Cannot update user-created subcategories. Only system subcategories can be updated.");
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) {
      // Check if another system subcategory with this name exists in the same category
      const { data: duplicate, error: dupError } = await supabase
        .from("Subcategory")
        .select("id")
        .eq("name", data.name)
        .eq("categoryId", existing.categoryId)
        .is("userId", null)
        .neq("id", id)
        .single();

      if (duplicate && !dupError) {
        throw new Error("A system subcategory with this name already exists in this category");
      }
      updateData.name = data.name;
    }
    
    if (data.logo !== undefined) {
      updateData.logo = data.logo;
    }

    const { data: subcategory, error } = await supabase
      .from("Subcategory")
      .update(updateData)
      .eq("id", id)
      .is("userId", null)
      .select()
      .single();

    if (error) {
      console.error("Supabase error updating system subcategory:", error);
      // Provide more specific error messages
      if (error.code === "PGRST116") {
        throw new Error("Subcategory not found or you don't have permission to update it");
      }
      if (error.message) {
        throw new Error(`Database error: ${error.message}`);
      }
      throw new Error(`Failed to update subcategory: ${JSON.stringify(error)}`);
    }

    // Invalidate cache for all users since system subcategory was updated
    await invalidateAllCategoriesCache();

    return {
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      createdAt: new Date(subcategory.createdAt),
      updatedAt: new Date(subcategory.updatedAt),
      userId: null,
      logo: subcategory.logo || null,
    };
  } catch (error) {
    console.error("Error in updateSystemSubcategory:", error);
    throw error;
  }
}

/**
 * Delete a system subcategory
 */
export async function deleteSystemSubcategory(id: string): Promise<void> {
  if (!(await isSuperAdmin())) {
    throw new Error("Unauthorized: Only super_admin can access this function");
  }

  try {
    const supabase = await createServerClient();

    // Verify it's a system subcategory
    const { data: existing, error: checkError } = await supabase
      .from("Subcategory")
      .select("id, userId")
      .eq("id", id)
      .single();

    if (checkError || !existing) {
      throw new Error("Subcategory not found");
    }

    if (existing.userId !== null) {
      throw new Error("Cannot delete user-created subcategories. Only system subcategories can be deleted.");
    }

    // Delete subcategory
    const { error } = await supabase
      .from("Subcategory")
      .delete()
      .eq("id", id)
      .is("userId", null);

    if (error) {
      throw error;
    }

    // Invalidate cache for all users since system subcategory was deleted
    await invalidateAllCategoriesCache();
  } catch (error) {
    console.error("Error in deleteSystemSubcategory:", error);
    throw error;
  }
}

