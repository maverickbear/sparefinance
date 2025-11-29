/**
 * Categories Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseCategory, BaseSubcategory, BaseGroup, CategoryWithRelations, SubcategoryWithRelations } from "../../domain/categories/categories.types";
import { CategoryRow, SubcategoryRow, GroupRow } from "../../infrastructure/database/repositories/categories.repository";

export class CategoriesMapper {
  /**
   * Map repository row to domain entity
   */
  static categoryToDomain(row: CategoryRow): BaseCategory {
    return {
      id: row.id,
      name: row.name,
      groupId: row.groupId,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static categoryToRepository(domain: Partial<BaseCategory>): Partial<CategoryRow> {
    return {
      id: domain.id,
      name: domain.name,
      groupId: domain.groupId,
      userId: domain.userId ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }

  /**
   * Map repository row to domain entity with relations
   */
  static categoryToDomainWithRelations(
    row: CategoryRow,
    group?: GroupRow | null
  ): CategoryWithRelations {
    return {
      ...this.categoryToDomain(row),
      group: group ? this.groupToDomain(group) : null,
    };
  }

  /**
   * Map repository row to domain entity
   */
  static subcategoryToDomain(row: SubcategoryRow): BaseSubcategory {
    return {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      userId: row.userId,
      logo: row.logo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static subcategoryToRepository(domain: Partial<BaseSubcategory>): Partial<SubcategoryRow> {
    return {
      id: domain.id,
      name: domain.name,
      categoryId: domain.categoryId,
      userId: domain.userId ?? null,
      logo: domain.logo ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
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

  /**
   * Map repository row to domain entity
   */
  static groupToDomain(row: GroupRow): BaseGroup {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static groupToRepository(domain: Partial<BaseGroup>): Partial<GroupRow> {
    return {
      id: domain.id,
      name: domain.name,
      type: domain.type ?? null,
      userId: domain.userId ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }
}

