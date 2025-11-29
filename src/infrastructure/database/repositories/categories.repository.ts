/**
 * Categories Repository
 * Data access layer for categories - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { BaseCategory, BaseSubcategory, BaseGroup } from "../../../domain/categories/categories.types";
import { logger } from "@/lib/utils/logger";

export interface CategoryRow {
  id: string;
  name: string;
  groupId: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubcategoryRow {
  id: string;
  name: string;
  categoryId: string;
  userId: string | null;
  logo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupRow {
  id: string;
  name: string;
  type: "income" | "expense" | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class CategoriesRepository {
  /**
   * Find all categories for a user
   */
  async findAllCategories(
    accessToken?: string,
    refreshToken?: string
  ): Promise<CategoryRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    let query = supabase
      .from("Category")
      .select("*")
      .order("name", { ascending: true });

    // If authenticated, get system defaults (userId IS NULL) OR user's own categories
    if (userId) {
      query = query.or(`userId.is.null,userId.eq.${userId}`);
    } else {
      // If not authenticated, only return system defaults
      query = query.is("userId", null);
    }

    const { data: categories, error } = await query;

    if (error) {
      logger.error("[CategoriesRepository] Error fetching categories:", error);
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    return (categories || []) as CategoryRow[];
  }

  /**
   * Find category by ID
   */
  async findCategoryById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<CategoryRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: category, error } = await supabase
      .from("Category")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error("[CategoriesRepository] Error fetching category:", error);
      throw new Error(`Failed to fetch category: ${error.message}`);
    }

    return category as CategoryRow;
  }

  /**
   * Create a new category
   */
  async createCategory(data: {
    id: string;
    name: string;
    groupId: string;
    userId: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<CategoryRow> {
    const supabase = await createServerClient();

    const { data: category, error } = await supabase
      .from("Category")
      .insert({
        id: data.id,
        name: data.name,
        groupId: data.groupId,
        userId: data.userId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("[CategoriesRepository] Error creating category:", error);
      throw new Error(`Failed to create category: ${error.message}`);
    }

    return category as CategoryRow;
  }

  /**
   * Update a category
   */
  async updateCategory(
    id: string,
    data: Partial<{
      name: string;
      groupId: string;
      updatedAt: string;
    }>
  ): Promise<CategoryRow> {
    const supabase = await createServerClient();

    const { data: category, error } = await supabase
      .from("Category")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[CategoriesRepository] Error updating category:", error);
      throw new Error(`Failed to update category: ${error.message}`);
    }

    return category as CategoryRow;
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Category")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[CategoriesRepository] Error deleting category:", error);
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }

  /**
   * Find all subcategories for a category
   */
  async findSubcategoriesByCategoryId(
    categoryId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<SubcategoryRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    let query = supabase
      .from("Subcategory")
      .select("*")
      .eq("categoryId", categoryId)
      .order("name", { ascending: true });

    // If authenticated, get system defaults (userId IS NULL) OR user's own subcategories
    if (userId) {
      query = query.or(`userId.is.null,userId.eq.${userId}`);
    } else {
      query = query.is("userId", null);
    }

    const { data: subcategories, error } = await query;

    if (error) {
      logger.error("[CategoriesRepository] Error fetching subcategories:", error);
      throw new Error(`Failed to fetch subcategories: ${error.message}`);
    }

    return (subcategories || []) as SubcategoryRow[];
  }

  /**
   * Find subcategory by ID
   */
  async findSubcategoryById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<SubcategoryRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: subcategory, error } = await supabase
      .from("Subcategory")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[CategoriesRepository] Error fetching subcategory:", error);
      throw new Error(`Failed to fetch subcategory: ${error.message}`);
    }

    return subcategory as SubcategoryRow;
  }

  /**
   * Create a new subcategory
   */
  async createSubcategory(data: {
    id: string;
    name: string;
    categoryId: string;
    userId: string | null;
    logo: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<SubcategoryRow> {
    const supabase = await createServerClient();

    const { data: subcategory, error } = await supabase
      .from("Subcategory")
      .insert({
        id: data.id,
        name: data.name,
        categoryId: data.categoryId,
        userId: data.userId,
        logo: data.logo,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("[CategoriesRepository] Error creating subcategory:", error);
      throw new Error(`Failed to create subcategory: ${error.message}`);
    }

    return subcategory as SubcategoryRow;
  }

  /**
   * Update a subcategory
   */
  async updateSubcategory(
    id: string,
    data: Partial<{
      name: string;
      categoryId: string;
      logo: string | null;
      updatedAt: string;
    }>
  ): Promise<SubcategoryRow> {
    const supabase = await createServerClient();

    const { data: subcategory, error } = await supabase
      .from("Subcategory")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[CategoriesRepository] Error updating subcategory:", error);
      throw new Error(`Failed to update subcategory: ${error.message}`);
    }

    return subcategory as SubcategoryRow;
  }

  /**
   * Delete a subcategory
   */
  async deleteSubcategory(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Subcategory")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[CategoriesRepository] Error deleting subcategory:", error);
      throw new Error(`Failed to delete subcategory: ${error.message}`);
    }
  }

  /**
   * Find all groups
   */
  async findAllGroups(
    accessToken?: string,
    refreshToken?: string
  ): Promise<GroupRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    let query = supabase
      .from("Group")
      .select("*")
      .order("name", { ascending: true });

    // If authenticated, get system defaults (userId IS NULL) OR user's own groups
    if (userId) {
      query = query.or(`userId.is.null,userId.eq.${userId}`);
    } else {
      query = query.is("userId", null);
    }

    const { data: groups, error } = await query;

    if (error) {
      logger.error("[CategoriesRepository] Error fetching groups:", error);
      throw new Error(`Failed to fetch groups: ${error.message}`);
    }

    return (groups || []) as GroupRow[];
  }

  /**
   * Find group by ID
   */
  async findGroupById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<GroupRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: group, error } = await supabase
      .from("Group")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[CategoriesRepository] Error fetching group:", error);
      throw new Error(`Failed to fetch group: ${error.message}`);
    }

    return group as GroupRow;
  }

  /**
   * Create a new group
   */
  async createGroup(data: {
    id: string;
    name: string;
    type: "income" | "expense" | null;
    userId: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<GroupRow> {
    const supabase = await createServerClient();

    const { data: group, error } = await supabase
      .from("Group")
      .insert({
        id: data.id,
        name: data.name,
        type: data.type,
        userId: data.userId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("[CategoriesRepository] Error creating group:", error);
      throw new Error(`Failed to create group: ${error.message}`);
    }

    return group as GroupRow;
  }

  /**
   * Update a group
   */
  async updateGroup(
    id: string,
    data: Partial<{
      name: string;
      type: "income" | "expense" | null;
      updatedAt: string;
    }>
  ): Promise<GroupRow> {
    const supabase = await createServerClient();

    const { data: group, error } = await supabase
      .from("Group")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[CategoriesRepository] Error updating group:", error);
      throw new Error(`Failed to update group: ${error.message}`);
    }

    return group as GroupRow;
  }

  /**
   * Delete a group
   */
  async deleteGroup(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Group")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[CategoriesRepository] Error deleting group:", error);
      throw new Error(`Failed to delete group: ${error.message}`);
    }
  }
}

