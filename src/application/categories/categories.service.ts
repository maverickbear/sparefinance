/**
 * Categories Service
 * Business logic for category management
 */

import { CategoriesRepository } from "@/src/infrastructure/database/repositories/categories.repository";
import { CategoriesMapper } from "./categories.mapper";
import { CategoryFormData, SubcategoryFormData, GroupFormData } from "../../domain/categories/categories.validations";
import { BaseCategory, BaseSubcategory, BaseGroup, CategoryWithRelations, SubcategoryWithRelations } from "../../domain/categories/categories.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getCurrentTimestamp } from "@/src/infrastructure/utils/timestamp";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { logger } from "@/src/infrastructure/utils/logger";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";

// Helper function to check if user can write
async function canUserWrite(userId: string): Promise<boolean> {
  const service = makeSubscriptionsService();
  return service.canUserWrite(userId);
}
import { invalidateCache } from "@/src/infrastructure/cache/cache.manager";

// In-memory cache for categories
const categoriesCache = new Map<string, { data: any[]; timestamp: number; userId: string | null }>();
const CATEGORIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache for groups
const groupsCache = new Map<string, { data: any[]; timestamp: number; userId: string | null }>();
const GROUPS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class CategoriesService {
  constructor(private repository: CategoriesRepository) {}

  /**
   * Invalidate categories cache for a user
   */
  async invalidateCategoriesCache(userId: string | null): Promise<void> {
    categoriesCache.delete(userId || 'null');
    groupsCache.delete(userId || 'null');
    logger.withPrefix("CATEGORIES").log("Invalidated cache for user:", userId || 'null');
  }

  /**
   * Invalidate categories cache for all users
   */
  async invalidateAllCategoriesCache(): Promise<void> {
    categoriesCache.clear();
    groupsCache.clear();
    logger.withPrefix("CATEGORIES").log("Invalidated cache for all users");
  }

  /**
   * Get all groups
   */
  async getGroups(
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseGroup[]> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    const cacheKey = userId || 'null';

    // Check cache
    const now = Date.now();
    const cached = groupsCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < GROUPS_CACHE_TTL) {
      return cached.data.map((row: any) => CategoriesMapper.groupToDomain(row));
    }

    const rows = await this.repository.findAllGroups(accessToken, refreshToken);

    // Update cache
    groupsCache.set(cacheKey, {
      data: rows,
      timestamp: now,
      userId,
    });

    return rows.map(row => CategoriesMapper.groupToDomain(row));
  }

  /**
   * Get all categories with relations
   */
  async getAllCategories(
    accessToken?: string,
    refreshToken?: string
  ): Promise<CategoryWithRelations[]> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    const cacheKey = userId || 'null';

    // Check cache
    const now = Date.now();
    const cached = categoriesCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CATEGORIES_CACHE_TTL) {
      return cached.data;
    }

    // Fetch categories
    const categoryRows = await this.repository.findAllCategories(accessToken, refreshToken);

    // Fetch groups for relations
    const groupRows = await this.repository.findAllGroups(accessToken, refreshToken);
    const groupsMap = new Map(groupRows.map(g => [g.id, g]));

    // Fetch subcategories
    const allSubcategories: any[] = [];
    for (const category of categoryRows) {
      const subcategories = await this.repository.findSubcategoriesByCategoryId(
        category.id,
        accessToken,
        refreshToken
      );
      allSubcategories.push(...subcategories.map(s => ({ ...s, categoryId: category.id })));
    }

    // Map to domain with relations
    const categories: CategoryWithRelations[] = categoryRows.map(categoryRow => {
      const group = groupsMap.get(categoryRow.groupId);
      const subcategories = allSubcategories.filter(s => s.categoryId === categoryRow.id);

      return {
        ...CategoriesMapper.categoryToDomainWithRelations(categoryRow, group),
        subcategories: subcategories.map(s => CategoriesMapper.subcategoryToDomain(s)),
      };
    });

    // Update cache
    categoriesCache.set(cacheKey, {
      data: categories,
      timestamp: now,
      userId,
    });

    return categories;
  }

  /**
   * Get categories by group
   */
  async getCategoriesByGroup(
    groupId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<CategoryWithRelations[]> {
    const allCategories = await this.getAllCategories(accessToken, refreshToken);
    return allCategories.filter(cat => cat.groupId === groupId);
  }

  /**
   * Get subcategories by category
   */
  async getSubcategoriesByCategory(
    categoryId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<SubcategoryWithRelations[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    // Verify category exists
    const category = await this.repository.findCategoryById(categoryId, accessToken, refreshToken);
    if (!category) {
      return [];
    }

    // Get subcategories
    const subcategoryRows = await this.repository.findSubcategoriesByCategoryId(
      categoryId,
      accessToken,
      refreshToken
    );

    return subcategoryRows.map(row =>
      CategoriesMapper.subcategoryToDomainWithRelations(row, category)
    );
  }

  /**
   * Create a new category
   */
  async createCategory(data: CategoryFormData): Promise<CategoryWithRelations> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Check if user has paid plan
    const isPaidPlan = await canUserWrite(userId);
    if (!isPaidPlan) {
      throw new Error("Creating custom categories requires a paid plan");
    }

    // Support both groupId and deprecated macroId
    const groupId = data.groupId || data.macroId;
    if (!groupId) {
      throw new Error("groupId is required");
    }

    // Verify group exists
    const group = await this.repository.findGroupById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const id = crypto.randomUUID();
    const now = getCurrentTimestamp();

    const categoryRow = await this.repository.createCategory({
      id,
      name: data.name,
      groupId,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    // Invalidate cache
    await this.invalidateCategoriesCache(userId);

    return CategoriesMapper.categoryToDomainWithRelations(categoryRow, group);
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, data: Partial<CategoryFormData>): Promise<CategoryWithRelations> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Verify category belongs to user
    const existingCategory = await this.repository.findCategoryById(id);
    if (!existingCategory) {
      throw new Error("Category not found");
    }

    if (existingCategory.userId !== userId) {
      throw new Error("Cannot update system default categories");
    }

    const updateData: any = {
      updatedAt: getCurrentTimestamp(),
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    // Support both groupId and deprecated macroId
    const groupId = data.groupId || data.macroId;
    if (groupId !== undefined) {
      const group = await this.repository.findGroupById(groupId);
      if (!group) {
        throw new Error("Group not found");
      }
      updateData.groupId = groupId;
    }

    const categoryRow = await this.repository.updateCategory(id, updateData);

    // Fetch group for relations
    const group = await this.repository.findGroupById(categoryRow.groupId);

    // Invalidate cache
    await this.invalidateCategoriesCache(userId);

    return CategoriesMapper.categoryToDomainWithRelations(categoryRow, group || null);
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Verify category belongs to user
    const category = await this.repository.findCategoryById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    if (category.userId !== userId) {
      throw new Error("Cannot delete system default categories");
    }

    await this.repository.deleteCategory(id);

    // Invalidate cache
    await this.invalidateCategoriesCache(userId);
  }

  /**
   * Create a new subcategory
   */
  async createSubcategory(data: SubcategoryFormData): Promise<SubcategoryWithRelations> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Verify category exists
    const category = await this.repository.findCategoryById(data.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    // If category is system default, user needs paid plan
    if (category.userId === null) {
      const isPaidPlan = await canUserWrite(userId);
      if (!isPaidPlan) {
        throw new Error("Creating subcategories for system default categories requires a paid plan");
      }
    } else if (category.userId !== userId) {
      throw new Error("Category not found or access denied");
    }

    const id = crypto.randomUUID();
    const now = getCurrentTimestamp();
    const subcategoryUserId = category.userId === null ? userId : category.userId;

    const subcategoryRow = await this.repository.createSubcategory({
      id,
      name: data.name,
      categoryId: data.categoryId,
      userId: subcategoryUserId,
      logo: data.logo || null,
      createdAt: now,
      updatedAt: now,
    });

    // Invalidate cache
    await this.invalidateCategoriesCache(userId);

    return CategoriesMapper.subcategoryToDomainWithRelations(subcategoryRow, category);
  }

  /**
   * Update a subcategory
   */
  async updateSubcategory(id: string, data: Partial<SubcategoryFormData>): Promise<SubcategoryWithRelations> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Verify subcategory exists and user has access
    const subcategory = await this.repository.findSubcategoryById(id);
    if (!subcategory) {
      throw new Error("Subcategory not found");
    }

    // Check if user can update (must own subcategory or category)
    const category = await this.repository.findCategoryById(subcategory.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    if (subcategory.userId !== userId && category.userId !== userId) {
      throw new Error("Cannot update this subcategory");
    }

    const updateData: any = {
      updatedAt: getCurrentTimestamp(),
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.logo !== undefined) {
      updateData.logo = data.logo || null;
    }

    const subcategoryRow = await this.repository.updateSubcategory(id, updateData);

    // Invalidate cache
    await this.invalidateCategoriesCache(userId);

    return CategoriesMapper.subcategoryToDomainWithRelations(subcategoryRow, category);
  }

  /**
   * Delete a subcategory
   */
  async deleteSubcategory(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Verify subcategory exists and user has access
    const subcategory = await this.repository.findSubcategoryById(id);
    if (!subcategory) {
      throw new Error("Subcategory not found");
    }

    // Check if user can delete (must own subcategory or category)
    const category = await this.repository.findCategoryById(subcategory.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    if (subcategory.userId !== userId && category.userId !== userId) {
      throw new Error("Cannot delete this subcategory");
    }

    await this.repository.deleteSubcategory(id);

    // Invalidate cache
    await this.invalidateCategoriesCache(userId);
  }

  /**
   * Delete a group
   */
  async deleteGroup(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Verify group exists and belongs to user (can't delete system defaults)
    const group = await this.repository.findGroupById(id);
    if (!group) {
      throw new Error("Group not found");
    }

    if (group.userId !== userId) {
      throw new Error("Cannot delete system default groups");
    }

    await this.repository.deleteGroup(id);

    // Invalidate cache
    await this.invalidateCategoriesCache(userId);
  }
}

