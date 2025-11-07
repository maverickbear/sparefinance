"use client";

import { supabase } from "@/lib/supabase";

export interface Category {
  id: string;
  name: string;
  macroId?: string | null;
  userId?: string | null;
  macro?: { id: string; name: string } | null;
  subcategories?: Array<{ id: string; name: string }>;
}

export interface Macro {
  id: string;
  name: string;
  userId?: string | null;
}

/**
 * Get all categories (system defaults + user's custom)
 */
export async function getAllCategoriesClient(): Promise<Category[]> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  let query = supabase
    .from("Category")
    .select(`
      *,
      macro:Macro(*),
      subcategories:Subcategory(*)
    `)
    .order("name", { ascending: true });

  if (authUser) {
    query = query.or(`userId.is.null,userId.eq.${authUser.id}`);
  } else {
    query = query.is("userId", null);
  }

  const { data: categories, error } = await query;

  if (error) {
    console.error("Supabase error fetching categories:", error);
    return [];
  }

  // Handle relations
  return (categories || []).map((cat: any) => ({
    ...cat,
    macro: Array.isArray(cat.macro) ? (cat.macro.length > 0 ? cat.macro[0] : null) : cat.macro,
    subcategories: Array.isArray(cat.subcategories) ? cat.subcategories : [],
  }));
}

/**
 * Get all macros (system defaults + user's custom)
 */
export async function getMacrosClient(): Promise<Macro[]> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  let query = supabase
    .from("Macro")
    .select("*")
    .order("name", { ascending: true });

  if (authUser) {
    query = query.or(`userId.is.null,userId.eq.${authUser.id}`);
  } else {
    query = query.is("userId", null);
  }

  const { data: macros, error } = await query;

  if (error) {
    console.error("Supabase error fetching macros:", error);
    return [];
  }

  return macros || [];
}

/**
 * Delete a category
 */
export async function deleteCategoryClient(id: string): Promise<void> {
  const { error } = await supabase.from("Category").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting category:", error);
    throw new Error(`Failed to delete category: ${error.message || JSON.stringify(error)}`);
  }
}

/**
 * Delete a subcategory
 */
export async function deleteSubcategoryClient(id: string): Promise<void> {
  const { error } = await supabase.from("Subcategory").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting subcategory:", error);
    throw new Error(`Failed to delete subcategory: ${error.message || JSON.stringify(error)}`);
  }
}

/**
 * Delete a macro
 */
export async function deleteMacroClient(id: string): Promise<void> {
  const { error } = await supabase.from("Macro").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting macro:", error);
    throw new Error(`Failed to delete macro: ${error.message || JSON.stringify(error)}`);
  }
}

