/**
 * Categories Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseCategory, BaseSubcategory, CategoryWithRelations, SubcategoryWithRelations } from "../../domain/categories/categories.types";
import { CategoryRow, SubcategoryRow } from "@/src/infrastructure/database/repositories/categories.repository";

export class CategoriesMapper {
  /**
   * Map repository row to domain entity
   */
  static categoryToDomain(row: CategoryRow): BaseCategory {
    // Default to "expense" if type is null (for backward compatibility with existing categories)
    // New categories should always have type set
    return {
      id: row.id,
      name: row.name,
      type: row.type || "expense",
      userId: row.user_id,
      isSystem: row.is_system,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static categoryToRepository(domain: Partial<BaseCategory>): Partial<CategoryRow> {
    return {
      id: domain.id,
      name: domain.name,
      type: domain.type ?? null,
      user_id: domain.userId ?? null,
      created_at: domain.createdAt,
      updated_at: domain.updatedAt,
    };
  }

  /**
   * Map repository row to domain entity with relations
   */
  static categoryToDomainWithRelations(row: CategoryRow): CategoryWithRelations {
    return {
      ...this.categoryToDomain(row),
    };
  }

  /**
   * Map repository row to domain entity
   */
  static subcategoryToDomain(row: SubcategoryRow): BaseSubcategory {
    return {
      id: row.id,
      name: row.name,
      categoryId: row.category_id,
      userId: row.user_id,
      isSystem: row.is_system,
      logo: row.logo,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static subcategoryToRepository(domain: Partial<BaseSubcategory>): Partial<SubcategoryRow> {
    return {
      id: domain.id,
      name: domain.name,
      category_id: domain.categoryId,
      user_id: domain.userId ?? null,
      logo: domain.logo ?? null,
      created_at: domain.createdAt,
      updated_at: domain.updatedAt,
    };
  }

  /**
   * Map repository row to domain entity with relations
   */
  static subcategoryToDomainWithRelations(
    row: SubcategoryRow,
    category?: CategoryRow | null
  ): SubcategoryWithRelations {
    return {
      ...this.subcategoryToDomain(row),
      category: category ? this.categoryToDomain(category) : null,
    };
  }
}

