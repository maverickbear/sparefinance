"use server";

import { createServerClient } from "@/lib/supabase-server";
import { getCurrentTimestamp } from "@/lib/utils/timestamp";
import { checkPlanLimits } from "@/lib/api/plans";

// Cache for categories (they don't change frequently)
const categoriesCache = new Map<string, { data: any[]; timestamp: number; userId: string | null }>();
const CATEGORIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for macros
const macrosCache = new Map<string, { data: any[]; timestamp: number; userId: string | null }>();
const MACROS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if user has a paid plan (not free)
 */
async function hasPaidPlan(userId: string): Promise<boolean> {
  try {
    const { plan } = await checkPlanLimits(userId);
    return plan !== null && plan.id !== "free";
  } catch (error) {
    console.error("Error checking plan:", error);
    return false;
  }
}

/**
 * Invalidate categories cache for a user
 */
export async function invalidateCategoriesCache(userId: string | null): Promise<void> {
  categoriesCache.delete(userId || 'null');
  macrosCache.delete(userId || 'null');
  console.log("[CATEGORIES] Invalidated cache for user:", userId || 'null');
}

/**
 * Invalidate categories cache for all users (used when system entities are modified)
 */
export async function invalidateAllCategoriesCache(): Promise<void> {
  categoriesCache.clear();
  macrosCache.clear();
  console.log("[CATEGORIES] Invalidated cache for all users (system entities modified)");
}

/**
 * Get all macros (system defaults + user's custom macros)
 */
export async function getMacros() {
  const supabase = await createServerClient();

  // Get current user for cache key
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  const userId = authUser?.id || null;
  const cacheKey = userId || 'null';
  
  // Check cache
  const now = Date.now();
  const cached = macrosCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < MACROS_CACHE_TTL) {
    console.log("[CATEGORIES] getMacros - Using cache for user:", userId || 'null');
    return cached.data;
  }
  
  if (authError || !authUser) {
    // If not authenticated, only return system defaults
    const { data, error } = await supabase
      .from("Macro")
      .select("*")
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      return [];
    }

    const result = data || [];
    
    // Update cache
    macrosCache.set(cacheKey, {
      data: result,
      timestamp: now,
      userId: null,
    });
    
    return result;
  }

  // Return system defaults (userId IS NULL) OR user's own macros
  const { data, error } = await supabase
    .from("Macro")
    .select("*")
    .or(`userId.is.null,userId.eq.${authUser.id}`)
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  const result = data || [];
  
  // Update cache
  macrosCache.set(cacheKey, {
    data: result,
    timestamp: now,
    userId,
  });
  
  return result;
}

export async function getCategoriesByMacro(macroId: string) {
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
      .eq("macroId", macroId)
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
    .eq("macroId", macroId)
    .or(`userId.is.null,userId.eq.${authUser.id}`)
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  return categories || [];
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
  
  // Check cache
  const now = Date.now();
  const cached = categoriesCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CATEGORIES_CACHE_TTL) {
    console.log("[CATEGORIES] getAllCategories - Using cache for user:", userId || 'null');
    return cached.data;
  }
  
  if (authError || !authUser) {
    // If not authenticated, only return system defaults
    const { data, error } = await supabase
      .from("Category")
      .select(`
        id,
        name,
        macroId,
        userId,
        createdAt,
        updatedAt,
        macro:Macro(*),
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
      macroId,
      userId,
      createdAt,
      updatedAt,
      macro:Macro(*),
      subcategories:Subcategory(*)
    `)
    .or(`userId.is.null,userId.eq.${authUser.id}`)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching categories:", error);
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

export async function createCategory(data: { name: string; macroId: string }) {
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

  // Verify macro belongs to user or is system default
  const { data: macro, error: macroError } = await supabase
    .from("Macro")
    .select("id, userId")
    .eq("id", data.macroId)
    .single();

  if (macroError || !macro) {
    throw new Error("Macro not found");
  }

  // If macro is system default (userId IS NULL), user can still create category under it
  // But category will be personal (with userId)
  const id = crypto.randomUUID();
  const now = getCurrentTimestamp();

  const { data: category, error } = await supabase
    .from("Category")
    .insert({
      id,
      name: data.name,
      macroId: data.macroId,
      userId: authUser.id, // Personal category
      createdAt: now,
      updatedAt: now,
    })
    .select(`
      *,
      macro:Macro(*),
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

export async function updateCategory(id: string, data: { name?: string; macroId?: string }) {
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
  
  if (data.macroId !== undefined) {
    // Verify new macro belongs to user or is system default
    const { data: macro, error: macroError } = await supabase
      .from("Macro")
      .select("id, userId")
      .eq("id", data.macroId)
      .single();

    if (macroError || !macro) {
      throw new Error("Macro not found");
    }

    updateData.macroId = data.macroId;
  }

  const { data: category, error } = await supabase
    .from("Category")
    .update(updateData)
    .eq("id", id)
    .eq("userId", authUser.id) // Only update user's own categories
    .select(`
      *,
      macro:Macro(*),
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
 * Create a custom macro (requires paid plan)
 */
export async function createMacro(data: { name: string }) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Check if user has paid plan (required for custom macros)
  const isPaidPlan = await hasPaidPlan(authUser.id);
  if (!isPaidPlan) {
    throw new Error("Creating custom macros requires a paid plan");
  }

  // Check if user already has a macro with this name
  // Note: Users can have macros with the same name as system defaults
  const { data: existingMacro, error: checkError } = await supabase
    .from("Macro")
    .select("id, userId")
    .eq("name", data.name)
    .eq("userId", authUser.id)
    .single();

  if (existingMacro && !checkError) {
    throw new Error("You already have a macro with this name");
  }

  const id = crypto.randomUUID();
  const now = getCurrentTimestamp();

  const { data: macro, error } = await supabase
    .from("Macro")
    .insert({
      id,
      name: data.name,
      userId: authUser.id, // Personal macro
      createdAt: now,
      updatedAt: now,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Supabase error creating macro:", error);
    throw new Error(`Failed to create macro: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return macro;
}

/**
 * Delete a custom macro (only user's own macros)
 */
export async function deleteMacro(id: string) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  // Verify macro belongs to user (can't delete system defaults)
  const { data: existingMacro, error: checkError } = await supabase
    .from("Macro")
    .select("id, userId")
    .eq("id", id)
    .single();

  if (checkError || !existingMacro) {
    throw new Error("Macro not found");
  }

  if (existingMacro.userId !== authUser.id) {
    throw new Error("Cannot delete system default macros");
  }

  // Delete the macro (categories will be cascade deleted)
  const { error } = await supabase
    .from("Macro")
    .delete()
    .eq("id", id)
    .eq("userId", authUser.id); // Only delete user's own macros

  if (error) {
    console.error("Supabase error deleting macro:", error);
    throw new Error(`Failed to delete macro: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache
  await invalidateCategoriesCache(authUser.id);

  return true;
}
