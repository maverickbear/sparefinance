/**
 * Categories Service
 * Business logic for category management
 */

import { CategoriesRepository } from "@/src/infrastructure/database/repositories/categories.repository";
import { CategoriesMapper } from "./categories.mapper";
import { CategoryFormData, SubcategoryFormData } from "../../domain/categories/categories.validations";
import { BaseCategory, BaseSubcategory, CategoryWithRelations, SubcategoryWithRelations } from "../../domain/categories/categories.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getCurrentTimestamp } from "@/src/infrastructure/utils/timestamp";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { logger } from "@/src/infrastructure/utils/logger";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import { cacheLife, cacheTag } from 'next/cache';

// Helper function to check if user can write
async function canUserWrite(userId: string): Promise<boolean> {
  const service = makeSubscriptionsService();
  return service.canUserWrite(userId);
}
import { AppError } from "../shared/app-error";

// Cached helper functions (must be standalone, not class methods)
// CRITICAL: Cannot pass repository as parameter in cached functions
// Must create repository inside the function to avoid "temporary client reference" error
async function getAllCategoriesCached(): Promise<CategoryWithRelations[]> {
  'use cache: private'
  cacheTag('categories')
  cacheLife('hours')

  // Can access cookies() directly with 'use cache: private'
  // Repository will access cookies through createServerClient()

  // Create repository inside cached function to avoid temporary client reference error
  const repository = new CategoriesRepository();

  // Fetch categories first
  const categoryRows = await repository.findAllCategories();
  const categoryIds = categoryRows.map(c => c.id);

  // Fetch subcategories in parallel (optimized: single query for all subcategories)
  const allSubcategoriesRaw = categoryIds.length > 0
    ? await repository.findSubcategoriesByCategoryIds(categoryIds)
    : [];

  const allSubcategories = allSubcategoriesRaw.map(s => ({ ...s, categoryId: s.category_id }));
  
  // Map to domain with relations
  const categories: CategoryWithRelations[] = categoryRows.map(categoryRow => {
    const subcategories = allSubcategories.filter(s => s.categoryId === categoryRow.id);

    return {
      ...CategoriesMapper.categoryToDomainWithRelations(categoryRow),
      subcategories: subcategories.map(s => CategoriesMapper.subcategoryToDomain(s)),
    };
  });

  return categories;
}

async function getSubcategoriesByCategoryCached(
  categoryId: string
): Promise<SubcategoryWithRelations[]> {
  'use cache: private'
  cacheTag('categories', `category-${categoryId}`)
  cacheLife('hours')
  
  // Can access cookies() directly with 'use cache: private'
  // Repository will access cookies through createServerClient()
  
  // Create repository inside cached function to avoid temporary client reference error
  const repository = new CategoriesRepository();

  // Verify category exists
  const category = await repository.findCategoryById(categoryId);
  if (!category) {
    return [];
  }

  // Get subcategories
  const subcategoryRows = await repository.findSubcategoriesByCategoryId(categoryId);

  return subcategoryRows.map(row =>
    CategoriesMapper.subcategoryToDomainWithRelations(row, category)
  );
}

export class CategoriesService {
  constructor(private repository: CategoriesRepository) {}

  /**
   * Get all categories with relations
   */
  async getAllCategories(): Promise<CategoryWithRelations[]> {
    return getAllCategoriesCached();
  }

  /**
   * Get subcategories by category
   */
  async getSubcategoriesByCategory(categoryId: string): Promise<SubcategoryWithRelations[]> {
    return getSubcategoriesByCategoryCached(categoryId);
  }

  /**
   * Create a new category
   */
  async createCategory(data: CategoryFormData): Promise<CategoryWithRelations> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    // Check if user has paid plan
    const isPaidPlan = await canUserWrite(userId);
    if (!isPaidPlan) {
      throw new AppError("Creating custom categories requires a paid plan", 403);
    }

    const id = crypto.randomUUID();
    const now = getCurrentTimestamp();

    const categoryRow = await this.repository.createCategory({
      id,
      name: data.name,
      type: data.type,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    return CategoriesMapper.categoryToDomainWithRelations(categoryRow);
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, data: Partial<CategoryFormData>): Promise<CategoryWithRelations> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    // Verify category belongs to user
    const existingCategory = await this.repository.findCategoryById(id);
    if (!existingCategory) {
      throw new AppError("Category not found", 404);
    }

    if (existingCategory.user_id !== userId) {
      throw new AppError("Cannot update system default categories", 403);
    }

    const updateData: any = {
      updatedAt: getCurrentTimestamp(),
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    const categoryRow = await this.repository.updateCategory(id, updateData);

    return CategoriesMapper.categoryToDomainWithRelations(categoryRow);
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    // Verify category belongs to user
    const category = await this.repository.findCategoryById(id);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    if (category.user_id !== userId) {
      throw new AppError("Cannot delete system default categories", 403);
    }

    await this.repository.deleteCategory(id);

  }

  /**
   * Create a new subcategory
   */
  async createSubcategory(data: SubcategoryFormData): Promise<SubcategoryWithRelations> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    // Verify category exists
    const category = await this.repository.findCategoryById(data.categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    // If category is system default, user needs paid plan
    if (category.is_system === true) {
      const isPaidPlan = await canUserWrite(userId);
      if (!isPaidPlan) {
        throw new AppError("Creating subcategories for system default categories requires a paid plan", 403);
      }
    } else if (category.user_id !== userId) {
      throw new AppError("Category not found or access denied", 404);
    }

    const id = crypto.randomUUID();
    const now = getCurrentTimestamp();
    const subcategoryUserId = category.is_system === true ? userId : category.user_id;

    const subcategoryRow = await this.repository.createSubcategory({
      id,
      name: data.name,
      categoryId: data.categoryId,
      userId: subcategoryUserId,
      logo: data.logo || null,
      createdAt: now,
      updatedAt: now,
    });


    return CategoriesMapper.subcategoryToDomainWithRelations(subcategoryRow, category);
  }

  /**
   * Update a subcategory
   */
  async updateSubcategory(id: string, data: Partial<SubcategoryFormData>): Promise<SubcategoryWithRelations> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    // Verify subcategory exists and user has access
    const subcategory = await this.repository.findSubcategoryById(id);
    if (!subcategory) {
      throw new AppError("Subcategory not found", 404);
    }

    // Check if user can update (must own subcategory or category)
    const category = await this.repository.findCategoryById(subcategory.category_id);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    if (subcategory.user_id !== userId && category.user_id !== userId) {
      throw new AppError("Cannot update this subcategory", 403);
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


    return CategoriesMapper.subcategoryToDomainWithRelations(subcategoryRow, category);
  }

  /**
   * Delete a subcategory
   */
  async deleteSubcategory(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    // Verify subcategory exists and user has access
    const subcategory = await this.repository.findSubcategoryById(id);
    if (!subcategory) {
      throw new AppError("Subcategory not found", 404);
    }

    // Check if user can delete (must own subcategory or category)
    const category = await this.repository.findCategoryById(subcategory.category_id);
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    if (subcategory.user_id !== userId && category.user_id !== userId) {
      throw new AppError("Cannot delete this subcategory", 403);
    }

    await this.repository.deleteSubcategory(id);

  }

}

