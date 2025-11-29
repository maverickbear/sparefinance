/**
 * Categories Factory
 * Dependency injection factory for CategoriesService
 */

import { CategoriesService } from "./categories.service";
import { CategoriesRepository } from "../../infrastructure/database/repositories/categories.repository";

/**
 * Create a CategoriesService instance with all dependencies
 */
export function makeCategoriesService(): CategoriesService {
  const repository = new CategoriesRepository();
  return new CategoriesService(repository);
}

