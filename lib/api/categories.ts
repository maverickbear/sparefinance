"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getCurrentTimestamp } from "@/src/infrastructure/utils/timestamp";
import { getUserSubscriptionData } from "@/lib/api/subscription";
import { logger } from "@/src/infrastructure/utils/logger";

// Cache for categories (they don't change frequently)
const categoriesCache = new Map<string, { data: any[]; timestamp: number; userId: string | null }>();
const CATEGORIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for groups
const groupsCache = new Map<string, { data: any[]; timestamp: number; userId: string | null }>();
const GROUPS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Deprecated: Use groupsCache instead
const macrosCache = groupsCache;
const MACROS_CACHE_TTL = GROUPS_CACHE_TTL;

/**
 * Check if user has a paid plan (not free)
 * This verifies that the subscription is active or trialing
 */
async function hasPaidPlan(userId: string): Promise<boolean> {
  try {
    const { canUserWrite } = await import("@/lib/api/subscription");
    return await canUserWrite(userId);
  } catch (error) {
    logger.error("Error checking plan:", error);
    return false;
  }
}

/**
 * Invalidate categories cache for a user
 */
export async function invalidateCategoriesCache(userId: string | null): Promise<void> {
  categoriesCache.delete(userId || 'null');
  groupsCache.delete(userId || 'null');
  logger.withPrefix("CATEGORIES").log("Invalidated cache for user:", userId || 'null');
}

/**
 * Invalidate categories cache for all users (used when system entities are modified)
 */
export async function invalidateAllCategoriesCache(): Promise<void> {
  categoriesCache.clear();
  groupsCache.clear();
  logger.withPrefix("CATEGORIES").log("Invalidated cache for all users (system entities modified)");
}

/**
 * Get all groups (system defaults + user's custom groups)
 */
export async function getGroups() {
  const supabase = await createServerClient();

  // Get current user for cache key
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  const userId = authUser?.id || null;
  const cacheKey = userId || 'null';
  
  const log = logger.withPrefix("CATEGORIES");
  
  // Check cache
  const now = Date.now();
  const cached = groupsCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < GROUPS_CACHE_TTL) {
    log.log("getGroups - Using cache for user:", userId || 'null');
    return cached.data;
  }
  
  if (authError || !authUser) {
    // If not authenticated, only return system defaults
    const { data, error } = await supabase
      .from("Group")
      .select("*")
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      return [];
    }

    const result = data || [];
    
    // Update cache
    groupsCache.set(cacheKey, {
      data: result,
      timestamp: now,
      userId: null,
    });
    
    return result;
  }

  // Return system defaults (userId IS NULL) OR user's own groups
  const { data, error } = await supabase
    .from("Group")
    .select("*")
    .or(`userId.is.null,userId.eq.${authUser.id}`)
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  const result = data || [];
  
  // Update cache
  groupsCache.set(cacheKey, {
    data: result,
    timestamp: now,
    userId,
  });
  
  return result;
}

// Deprecated: Use getGroups instead
export async function getMacros() {
  return getGroups();
}

export async function getCategoriesByGroup(groupId: string) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    // If not authenticated, only return system defaults
    const { data: categories, error } = await supabase
      .from("Category")
      .select(`
        *,
        subcategories:Subcategory(*)
      `)
      .eq("groupId", groupId)
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      return [];
    }

    return categories || [];
  }

  // Return system defaults (userId IS NULL) OR user's own categories
  const { data: categories, error } = await supabase
    .from("Category")
    .select(`
      *,
      subcategories:Subcategory(*)
    `)
    .eq("groupId", groupId)
    .or(`userId.is.null,userId.eq.${authUser.id}`)
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  return categories || [];
}

// Deprecated: Use getCategoriesByGroup instead
export async function getCategoriesByMacro(macroId: string) {
  return getCategoriesByGroup(macroId);
}

export async function getSubcategoriesByCategory(categoryId: string) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  // Verify category exists and user has access
  const { data: category, error: categoryError } = await supabase
    .from("Category")
    .select("id, userId")
    .eq("id", categoryId)
    .single();

  if (categoryError || !category) {
    return [];
  }

  // If not authenticated, only return subcategories from system categories
  if (authError || !authUser) {
    if (category.userId !== null) {
      return []; // Can't access user's categories without auth
    }

    const { data, error } = await supabase
      .from("Subcategory")
      .select("*")
      .eq("categoryId", categoryId)
      .order("name", { ascending: true });

    if (error) {
      return [];
    }

    return data || [];
  }

  // Return subcategories from system categories OR user's own categories
  // RLS will handle filtering automatically
  const { data, error } = await supabase
    .from("Subcategory")
    .select("*")
    .eq("categoryId", categoryId)
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  return data || [];
}

export async function getAllCategories() {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  const userId = authUser?.id || null;
  const cacheKey = userId || 'null';
  
  const log = logger.withPrefix("CATEGORIES");
  
  // Check cache
  const now = Date.now();
  const cached = categoriesCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CATEGORIES_CACHE_TTL) {
    log.log("getAllCategories - Using cache for user:", userId || 'null');
    return cached.data;
  }
  
  if (authError || !authUser) {
    // If not authenticated, only return system defaults
    const { data, error } = await supabase
      .from("Category")
      .select(`
        id,
        name,
        groupId,
        userId,
        createdAt,
        updatedAt,
        group:Group(*),
        subcategories:Subcategory(*)
      `)
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      return [];
    }

    // Remove duplicates by ID (in case query returns duplicates)
    const uniqueData = Array.from(
      new Map((data || []).map((cat: any) => [cat.id, cat])).values()
    );

    // Update cache
    categoriesCache.set(cacheKey, {
      data: uniqueData,
      timestamp: now,
      userId: null,
    });

    return uniqueData;
  }

  // Return system defaults (userId IS NULL) OR user's own categories
  const { data, error } = await supabase
    .from("Category")
    .select(`
      id,
      name,
      groupId,
      userId,
      createdAt,
      updatedAt,
      group:Group(*),
      subcategories:Subcategory(*)
    `)
    .or(`userId.is.null,userId.eq.${authUser.id}`)
    .order("name", { ascending: true });

  if (error) {
    logger.error("Error fetching categories:", error);
    return [];
  }

  // Remove duplicates by ID (in case query returns duplicates)
  const uniqueData = Array.from(
    new Map((data || []).map((cat: any) => [cat.id, cat])).values()
  );

  // Update cache
  categoriesCache.set(cacheKey, {
    data: uniqueData,
    timestamp: now,
    userId,
  });

  return uniqueData;
}

export async function createCategory(data: { name: string; groupId: string; macroId?: string }) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Check if user has paid plan (required for custom categories)
  const isPaidPlan = await hasPaidPlan(authUser.id);
  if (!isPaidPlan) {
    throw new Error("Creating custom categories requires a paid plan");
  }

  // Support both groupId and deprecated macroId for backward compatibility
  const groupId = data.groupId || data.macroId;
  if (!groupId) {
    throw new Error("groupId is required");
  }

  // Verify group belongs to user or is system default
  const { data: group, error: groupError } = await supabase
    .from("Group")
    .select("id, userId")
    .eq("id", groupId)
    .single();

  if (groupError || !group) {
    throw new Error("Group not found");
  }

  // If group is system default (userId IS NULL), user can still create category under it
  // But category will be personal (with userId)
  const id = crypto.randomUUID();
  const now = getCurrentTimestamp();

  const { data: category, error } = await supabase
    .from("Category")
    .insert({
      id,
      name: data.name,
      groupId: groupId,
      userId: authUser.id, // Personal category
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
    console.error("Supabase error creating category:", error);
    throw new Error(`Failed to create category: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return category;
}

export async function updateCategory(id: string, data: { name?: string; groupId?: string; macroId?: string }) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Verify category belongs to user (can't update system defaults)
  const { data: existingCategory, error: checkError } = await supabase
    .from("Category")
    .select("id, userId")
    .eq("id", id)
    .single();

  if (checkError || !existingCategory) {
    throw new Error("Category not found");
  }

  if (existingCategory.userId !== authUser.id) {
    throw new Error("Cannot update system default categories");
  }

  const updateData: Record<string, unknown> = {
    updatedAt: getCurrentTimestamp(),
  };
  
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  
  // Support both groupId and deprecated macroId for backward compatibility
  const groupId = data.groupId || data.macroId;
  if (groupId !== undefined) {
    // Verify new group belongs to user or is system default
    const { data: group, error: groupError } = await supabase
      .from("Group")
      .select("id, userId")
      .eq("id", groupId)
      .single();

    if (groupError || !group) {
      throw new Error("Group not found");
    }

    updateData.groupId = groupId;
  }

  const { data: category, error } = await supabase
    .from("Category")
    .update(updateData)
    .eq("id", id)
    .eq("userId", authUser.id) // Only update user's own categories
    .select(`
      *,
      macro:Group(*),
      subcategories:Subcategory(*)
    `)
    .single();

  if (error) {
    console.error("Supabase error updating category:", error);
    throw new Error(`Failed to update category: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return category;
}

export async function createSubcategory(data: { name: string; categoryId: string; logo?: string | null }) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Verify category belongs to user or is system default
  const { data: category, error: categoryError } = await supabase
    .from("Category")
    .select("id, userId")
    .eq("id", data.categoryId)
    .single();

  if (categoryError || !category) {
    throw new Error("Category not found");
  }

  // If category is system default (userId IS NULL), user needs paid plan to create subcategory
  if (category.userId === null) {
    const isPaidPlan = await hasPaidPlan(authUser.id);
    if (!isPaidPlan) {
      throw new Error("Creating subcategories for system default categories requires a paid plan");
    }
  } else if (category.userId !== authUser.id) {
    throw new Error("Category not found or access denied");
  }

  const id = crypto.randomUUID();
  const now = getCurrentTimestamp();

  // Determine userId: if category is system default, user creates subcategory with their userId
  // If category belongs to user, subcategory also belongs to user
  const subcategoryUserId = category.userId === null ? authUser.id : category.userId;

  const { data: subcategory, error } = await supabase
    .from("Subcategory")
    .insert({
      id,
      name: data.name,
      categoryId: data.categoryId,
      userId: subcategoryUserId, // Set userId to identify user-created subcategories
      logo: data.logo || null,
      createdAt: now,
      updatedAt: now,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Supabase error creating subcategory:", error);
    throw new Error(`Failed to create subcategory: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return subcategory;
}

export async function updateSubcategory(id: string, data: { name?: string; logo?: string | null }) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Verify subcategory belongs to user (can't update system defaults)
  const { data: existingSubcategory, error: checkError } = await supabase
    .from("Subcategory")
    .select("id, userId")
    .eq("id", id)
    .single();

  if (checkError || !existingSubcategory) {
    throw new Error("Subcategory not found");
  }

  // If subcategory userId is null, it's a system default - cannot update
  if (existingSubcategory.userId === null) {
    throw new Error("Cannot update system default subcategories");
  }

  // If subcategory userId doesn't match current user, cannot update
  if (existingSubcategory.userId !== authUser.id) {
    throw new Error("Cannot update subcategories that don't belong to you");
  }

  const updateData: Record<string, unknown> = {
    updatedAt: getCurrentTimestamp(),
  };
  
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  
  if (data.logo !== undefined) {
    updateData.logo = data.logo;
  }

  const { data: subcategory, error } = await supabase
    .from("Subcategory")
    .update(updateData)
    .eq("id", id)
    .eq("userId", authUser.id) // Only update user's own subcategories
    .select("*")
    .single();

  if (error) {
    console.error("Supabase error updating subcategory:", error);
    throw new Error(`Failed to update subcategory: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return subcategory;
}

export async function deleteSubcategory(id: string) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Verify subcategory exists and check userId
  const { data: existingSubcategory, error: checkError } = await supabase
    .from("Subcategory")
    .select("id, userId")
    .eq("id", id)
    .single();

  if (checkError || !existingSubcategory) {
    throw new Error("Subcategory not found");
  }

  // If subcategory userId is null, it's a system default - cannot delete
  if (existingSubcategory.userId === null) {
    throw new Error("Cannot delete system default subcategories");
  }

  // If subcategory userId doesn't match current user, cannot delete
  if (existingSubcategory.userId !== authUser.id) {
    throw new Error("Cannot delete subcategories that don't belong to you");
  }

  // User can delete their own subcategories
  const { error } = await supabase
    .from("Subcategory")
    .delete()
    .eq("id", id)
    .eq("userId", authUser.id); // Only delete user's own subcategories

  if (error) {
    console.error("Supabase error deleting subcategory:", error);
    throw new Error(`Failed to delete subcategory: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return true;
}

export async function deleteCategory(id: string) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Verify category belongs to user (can't delete system defaults)
  const { data: existingCategory, error: checkError } = await supabase
    .from("Category")
    .select("id, userId")
    .eq("id", id)
    .single();

  if (checkError || !existingCategory) {
    throw new Error("Category not found");
  }

  if (existingCategory.userId !== authUser.id) {
    throw new Error("Cannot delete system default categories");
  }

  // First delete all subcategories associated with this category
  const { error: subcategoryError } = await supabase
    .from("Subcategory")
    .delete()
    .eq("categoryId", id);

  if (subcategoryError) {
    console.error("Supabase error deleting subcategories:", subcategoryError);
    throw new Error(`Failed to delete subcategories: ${subcategoryError.message || JSON.stringify(subcategoryError)}`);
  }

  // Then delete the category itself
  const { error } = await supabase
    .from("Category")
    .delete()
    .eq("id", id)
    .eq("userId", authUser.id); // Only delete user's own categories

  if (error) {
    console.error("Supabase error deleting category:", error);
    throw new Error(`Failed to delete category: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return true;
}

/**
 * Create a custom group (requires paid plan)
 */
export async function createGroup(data: { name: string }) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Check if user has paid plan (required for custom groups)
  const isPaidPlan = await hasPaidPlan(authUser.id);
  if (!isPaidPlan) {
    throw new Error("Creating custom groups requires a paid plan");
  }

  // Check if user already has a group with this name
  // Note: Users can have groups with the same name as system defaults
  const { data: existingGroup, error: checkError } = await supabase
    .from("Group")
    .select("id, userId")
    .eq("name", data.name)
    .eq("userId", authUser.id)
    .single();

  if (existingGroup && !checkError) {
    throw new Error("You already have a group with this name");
  }

  const id = crypto.randomUUID();
  const now = getCurrentTimestamp();

  const { data: group, error } = await supabase
    .from("Group")
    .insert({
      id,
      name: data.name,
      userId: authUser.id, // Personal group
      createdAt: now,
      updatedAt: now,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Supabase error creating group:", error);
    throw new Error(`Failed to create group: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return group;
}

// Deprecated: Use createGroup instead
export async function createMacro(data: { name: string }) {
  return createGroup(data);
}

/**
 * Delete a custom group (only user's own groups)
 */
export async function deleteGroup(id: string) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Verify group belongs to user (can't delete system defaults)
  const { data: existingGroup, error: checkError } = await supabase
    .from("Group")
    .select("id, userId")
    .eq("id", id)
    .single();

  if (checkError || !existingGroup) {
    throw new Error("Group not found");
  }

  if (existingGroup.userId !== authUser.id) {
    throw new Error("Cannot delete system default groups");
  }

  // Delete the group (categories will be cascade deleted)
  const { error } = await supabase
    .from("Group")
    .delete()
    .eq("id", id)
    .eq("userId", authUser.id); // Only delete user's own groups

  if (error) {
    console.error("Supabase error deleting group:", error);
    throw new Error(`Failed to delete group: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return true;
}
