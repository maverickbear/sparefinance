/**
 * Categories Repository Interface
 * Contract for category data access
 */

import { CategoryRow, SubcategoryRow } from "../categories.repository";

export interface ICategoriesRepository {
  findCategoriesByIds(
    ids: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<CategoryRow[]>;
  findCategoryById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<CategoryRow | null>;
  findSubcategoriesByIds(
    ids: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<SubcategoryRow[]>;
  findSubcategoryById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<SubcategoryRow | null>;
  createCategory(data: {
    id: string;
    name: string;
    type: "income" | "expense";
    userId: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<CategoryRow>;
  createSubcategory(data: {
    id: string;
    name: string;
    categoryId: string;
    logo: string | null;
    userId: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<SubcategoryRow>;
}

