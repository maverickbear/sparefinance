"use server";

import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
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
  isBlocked?: boolean;
  plan: {
    id: string;
    name: string;
  } | null;
  subscription: {
    id: string;
    status: string;
    planId: string;
    trialEndDate: string | null;
    trialStartDate: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
  } | null;
  household: {
    hasHousehold: boolean;
    isOwner: boolean;
    memberCount: number;
    householdId: string | null;
    ownerId: string | null;
  };
  pendingMembers?: Array<{
    email: string | null;
    name: string | null;
    status: string;
  }>;
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
    // Use service role client to bypass RLS and get all users
    const supabase = createServiceRoleClient();

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("User")
      .select("id, email, name, createdAt, isBlocked")
      .order("createdAt", { ascending: false });

    if (usersError) {
      console.error("[getAllUsers] Error fetching users:", usersError);
      throw usersError;
    }

    if (!users || users.length === 0) {
      console.log("[getAllUsers] No users found");
      return [];
    }

    console.log(`[getAllUsers] Found ${users.length} users`);

    const userIds = users.map((u) => u.id);

    // Get all subscriptions (not just active ones, to show all subscription statuses)
    const { data: subscriptions, error: subsError } = await supabase
      .from("Subscription")
      .select("id, userId, planId, status, trialEndDate, trialStartDate, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd")
      .in("userId", userIds)
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
    
    // Create a map of userId to most recent subscription
    // Since subscriptions are already ordered by createdAt DESC, we just need the first one per user
    const subscriptionMap = new Map<string, { 
      id: string; 
      userId: string; 
      planId: string; 
      status: string;
      trialEndDate: string | null;
      trialStartDate: string | null;
      stripeSubscriptionId: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean | null;
    }>();
    (subscriptions || []).forEach((s) => {
      if (!subscriptionMap.has(s.userId)) {
        subscriptionMap.set(s.userId, s);
      }
    });

    // Get household information for all users
    // Get all households created by users (owners)
    const { data: ownedHouseholds, error: householdError1 } = await supabase
      .from("Household")
      .select("id, createdBy, type")
      .in("createdBy", userIds);

    // Get all household IDs owned by these users (including personal with members)
    const allOwnedHouseholdIds = (ownedHouseholds || []).map(h => h.id);
    
    // Get all household memberships:
    // 1. Active members with userId in our list
    // 2. All members (active or pending) of households owned by users in our list (including pending without userId)
    let householdMembersQuery = supabase
      .from("HouseholdMember")
      .select("userId, householdId, status, email, name, Household(createdBy, type)")
      .in("status", ["active", "pending"]);
    
    if (userIds.length > 0 || allOwnedHouseholdIds.length > 0) {
      const conditions: string[] = [];
      if (userIds.length > 0) {
        conditions.push(`userId.in.(${userIds.join(',')})`);
      }
      if (allOwnedHouseholdIds.length > 0) {
        conditions.push(`householdId.in.(${allOwnedHouseholdIds.join(',')})`);
      }
      if (conditions.length > 0) {
        householdMembersQuery = householdMembersQuery.or(conditions.join(','));
      }
    }
    
    const { data: householdMembers, error: householdError2 } = await householdMembersQuery;

    if (householdError1 || householdError2) {
      console.error("Error fetching household members:", householdError1 || householdError2);
    }

    // Build household info map
    const householdInfoMap = new Map<string, { hasHousehold: boolean; isOwner: boolean; memberCount: number; householdId: string | null; ownerId: string | null }>();
    
    // Count members per household owner
    const ownerMemberCounts = new Map<string, number>();
    const householdOwnerMap = new Map<string, string>(); // householdId -> createdBy
    const householdIdToOwnerMap = new Map<string, string>(); // householdId -> ownerId
    
    // Map owned households (include personal households that have additional members)
    (ownedHouseholds || []).forEach((h) => {
      householdOwnerMap.set(h.id, h.createdBy);
      householdIdToOwnerMap.set(h.id, h.createdBy);
    });
    
    // Count members per owner (count all households, including personal with members)
    (householdMembers || []).forEach((hm: any) => {
      const household = hm.Household as any;
      if (household && household.createdBy) {
        const ownerId = household.createdBy;
        // Only count if this member is not the owner themselves
        if (hm.userId !== ownerId) {
          ownerMemberCounts.set(ownerId, (ownerMemberCounts.get(ownerId) || 0) + 1);
        }
        householdIdToOwnerMap.set(hm.householdId, ownerId);
      }
    });

    // Check if user is owner or member
    userIds.forEach((userId) => {
      // Check if user owns any household (including personal with members)
      const ownedHousehold = (ownedHouseholds || []).find((h) => {
        if (h.createdBy !== userId) return false;
        // Include if it's a household type OR if it's personal but has members
        if (h.type !== 'personal') return true;
        // Check if this personal household has additional members
        const hasAdditionalMembers = (householdMembers || []).some((hm: any) => {
          return hm.householdId === h.id && hm.userId !== userId;
        });
        return hasAdditionalMembers;
      });
      const isOwner = !!ownedHousehold;
      
      // Check if user is a member of any household (not as owner)
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
        ownerId = userId; // Owner is themselves
      } else if (isMember && memberHousehold) {
        householdId = memberHousehold.householdId;
        const household = memberHousehold.Household as any;
        ownerId = household?.createdBy || null;
      }
      
      householdInfoMap.set(userId, {
        hasHousehold: isOwner || isMember,
        isOwner,
        memberCount: isOwner ? (ownerMemberCounts.get(userId) || 0) : 0,
        householdId,
        ownerId,
      });
    });

    // Build pending members map by household (include all households, including personal with members)
    const pendingMembersByHousehold = new Map<string, Array<{ email: string | null; name: string | null; status: string }>>();
    (householdMembers || []).forEach((hm: any) => {
      const household = hm.Household as any;
      if (household && hm.status === "pending") {
        const householdId = hm.householdId;
        if (!pendingMembersByHousehold.has(householdId)) {
          pendingMembersByHousehold.set(householdId, []);
        }
        pendingMembersByHousehold.get(householdId)!.push({
          email: hm.email || null,
          name: hm.name || null,
          status: hm.status,
        });
      }
    });

    // Map users with their data
    const adminUsers: AdminUser[] = users.map((user) => {
      const subscription = subscriptionMap.get(user.id);
      const plan = subscription ? planMap.get(subscription.planId) : null;
      const household = householdInfoMap.get(user.id) || {
        hasHousehold: false,
        isOwner: false,
        memberCount: 0,
        householdId: null,
        ownerId: null,
      };

      // Get pending members for this owner's household
      const pendingMembers = household.isOwner && household.householdId
        ? (pendingMembersByHousehold.get(household.householdId) || [])
        : undefined;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date(user.createdAt),
        isBlocked: user.isBlocked || false,
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
              trialEndDate: subscription.trialEndDate || null,
              trialStartDate: subscription.trialStartDate || null,
              stripeSubscriptionId: subscription.stripeSubscriptionId || null,
              currentPeriodEnd: subscription.currentPeriodEnd || null,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
            }
          : null,
        household,
        pendingMembers,
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
    const categoriesService = makeCategoriesService();
    await categoriesService.invalidateAllCategoriesCache();

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
    const categoriesService = makeCategoriesService();
    await categoriesService.invalidateAllCategoriesCache();

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
    const categoriesService = makeCategoriesService();
    await categoriesService.invalidateAllCategoriesCache();
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
      macroId: cat.groupId, // Backward compatibility: map groupId to macroId
      createdAt: new Date(cat.createdAt),
      updatedAt: new Date(cat.updatedAt),
      userId: null,
      group: cat.group
        ? {
            id: cat.group.id,
            name: cat.group.name,
            type: (cat.group as any).type ?? null,
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
      .eq("groupId", data.macroId)
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
        groupId: data.macroId,
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
    const categoriesService = makeCategoriesService();
    await categoriesService.invalidateAllCategoriesCache();

    return {
      id: category.id,
      name: category.name,
      macroId: category.groupId, // Backward compatibility: map groupId to macroId
      createdAt: new Date(category.createdAt),
      updatedAt: new Date(category.updatedAt),
      userId: null,
      group: category.group
        ? {
            id: category.group.id,
            name: category.group.name,
            type: (category.group as any).type ?? null,
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
      .select("id, userId, groupId")
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
        .eq("groupId", existing.groupId)
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
          .eq("groupId", data.macroId)
          .is("userId", null)
          .neq("id", id)
          .single();

        if (duplicate && !dupError) {
          throw new Error("A system category with this name already exists in the target macro");
        }
      }

      updateData.groupId = data.macroId;
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
    const categoriesService = makeCategoriesService();
    await categoriesService.invalidateAllCategoriesCache();

    return {
      id: category.id,
      name: category.name,
      macroId: category.groupId, // Backward compatibility: map groupId to macroId
      createdAt: new Date(category.createdAt),
      updatedAt: new Date(category.updatedAt),
      userId: null,
      group: category.group
        ? {
            id: category.group.id,
            name: category.group.name,
            type: (category.group as any).type ?? null,
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
    const categoriesService = makeCategoriesService();
    await categoriesService.invalidateAllCategoriesCache();
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
    const categoriesService = makeCategoriesService();
    await categoriesService.invalidateAllCategoriesCache();

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
    const categoriesService = makeCategoriesService();
    await categoriesService.invalidateAllCategoriesCache();

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
    const categoriesService = makeCategoriesService();
    await categoriesService.invalidateAllCategoriesCache();
  } catch (error) {
    console.error("Error in deleteSystemSubcategory:", error);
    throw error;
  }
}

