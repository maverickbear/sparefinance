"use client";

import { supabase } from "@/lib/supabase";

export interface Category {
  id: string;
  name: string;
  macroId?: string | null;
  userId?: string | null;
  macro?: { id: string; name: string } | null;
  subcategories?: Array<{ id: string; name: string; logo?: string | null }>;
}

export interface Macro {
  id: string;
  name: string;
  userId?: string | null;
}

/**
 * Get all categories (system defaults + user's custom)
 * Uses API route which has server-side caching
 */
export async function getAllCategoriesClient(): Promise<Category[]> {
  try {
    const response = await fetch("/api/categories?all=true");
    if (!response.ok) {
      console.error("Error fetching categories:", response.statusText);
    return [];
  }
    const categories = await response.json();

    // Handle relations (ensure consistent format)
  return (categories || []).map((cat: any) => ({
    ...cat,
    macro: Array.isArray(cat.macro) ? (cat.macro.length > 0 ? cat.macro[0] : null) : cat.macro,
    subcategories: Array.isArray(cat.subcategories) ? cat.subcategories : [],
  }));
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

/**
 * Get all macros (system defaults + user's custom)
 * Uses API route which has server-side caching
 */
export async function getMacrosClient(): Promise<Macro[]> {
  try {
    const response = await fetch("/api/categories");
    if (!response.ok) {
      console.error("Error fetching macros:", response.statusText);
      return [];
  }
    return await response.json();
  } catch (error) {
    console.error("Error fetching macros:", error);
    return [];
  }
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

