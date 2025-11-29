"use client";

import { supabase } from "@/lib/supabase";

export interface Category {
  id: string;
  name: string;
  groupId?: string | null;
  userId?: string | null;
  group?: { id: string; name: string } | null;
  subcategories?: Array<{ id: string; name: string; logo?: string | null }>;
}

export interface Group {
  id: string;
  name: string;
  userId?: string | null;
}

// Deprecated: Use Group instead
export type Macro = Group;

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
    // Support both old (macro) and new (group) field names for backward compatibility
    group: Array.isArray(cat.group) ? (cat.group.length > 0 ? cat.group[0] : null) : 
           (cat.group || (Array.isArray(cat.macro) ? (cat.macro.length > 0 ? cat.macro[0] : null) : cat.macro)),
    groupId: cat.groupId || cat.macroId,
    subcategories: Array.isArray(cat.subcategories) ? cat.subcategories : [],
  }));
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

/**
 * Get all groups (system defaults + user's custom)
 * Uses API route which has server-side caching
 */
export async function getGroupsClient(): Promise<Group[]> {
  try {
    const response = await fetch("/api/categories");
    if (!response.ok) {
      console.error("Error fetching groups:", response.statusText);
      return [];
  }
    return await response.json();
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}

// Deprecated: Use getGroupsClient instead
export async function getMacrosClient(): Promise<Group[]> {
  return getGroupsClient();
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
 * Delete a group
 */
export async function deleteGroupClient(id: string): Promise<void> {
  const { error } = await supabase.from("Group").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting group:", error);
    throw new Error(`Failed to delete group: ${error.message || JSON.stringify(error)}`);
  }
}

// Deprecated: Use deleteGroupClient instead
export async function deleteMacroClient(id: string): Promise<void> {
  return deleteGroupClient(id);
}

