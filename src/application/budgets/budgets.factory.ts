/**
 * Budgets Factory
 * Dependency injection factory for BudgetsService
 */

import { BudgetsService } from "./budgets.service";
import { BudgetsRepository } from "@/src/infrastructure/database/repositories/budgets.repository";

/**
 * Create a BudgetsService instance with all dependencies
 */
export function makeBudgetsService(): BudgetsService {
  const repository = new BudgetsRepository();
  return new BudgetsService(repository);
}

