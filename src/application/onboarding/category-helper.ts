/**
 * Category Helper
 * Helper functions for finding and creating categories for onboarding
 */

import { makeCategoriesService } from "../categories/categories.factory";
import { BaseCategory } from "../../domain/categories/categories.types";
import { logger } from "@/src/infrastructure/utils/logger";

export class CategoryHelper {
  /**
   * Find category by name (case-insensitive)
   */
  async findCategoryByName(
    name: string,
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseCategory | null> {
    try {
      const categoriesService = makeCategoriesService();
      const allCategories = await categoriesService.getAllCategories();

      // Find category by name (case-insensitive)
      const category = allCategories.find(
        (cat) => cat.name.toLowerCase().trim() === name.toLowerCase().trim()
      );

      return category || null;
    } catch (error) {
      logger.error("[CategoryHelper] Error finding category by name:", error);
      return null;
    }
  }

  /**
   * Find or create category by name
   * For onboarding, we prefer to use existing system categories
   * Only creates if absolutely necessary and user has permission
   */
  async findOrCreateCategory(
    name: string,
    categoryType: "income" | "expense",
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseCategory | null> {
    try {
      // First try to find existing category
      const existing = await this.findCategoryByName(name, userId, accessToken, refreshToken);
      if (existing) {
        return existing;
      }

      // For onboarding, we prefer not to create categories
      // Try to find a similar category of the same type
      const categoriesService = makeCategoriesService();
      const allCategories = await categoriesService.getAllCategories();
      const similarCategory = allCategories.find(
        (cat) => cat.type === categoryType && cat.name.toLowerCase().includes(name.toLowerCase())
      );

      if (similarCategory) {
        logger.info(`[CategoryHelper] Using existing category "${similarCategory.name}" instead of creating "${name}"`);
        return similarCategory;
      }

      // Last resort: try to create (may fail if user doesn't have paid plan)
      // This is OK - we'll just skip that budget category
      try {
        const newCategory = await categoriesService.createCategory({
          name,
          type: categoryType,
        });

        return newCategory;
      } catch (createError) {
        // Creation failed (likely due to plan restrictions)
        logger.warn(`[CategoryHelper] Could not create category "${name}":`, createError);
        return null;
      }
    } catch (error) {
      logger.error("[CategoryHelper] Error finding or creating category:", error);
      return null;
    }
  }
}

