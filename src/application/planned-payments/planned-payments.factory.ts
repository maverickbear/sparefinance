/**
 * Planned Payments Factory
 * Dependency injection factory for PlannedPaymentsService
 */

import { PlannedPaymentsService } from "./planned-payments.service";
import { PlannedPaymentsRepository } from "@/src/infrastructure/database/repositories/planned-payments.repository";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";
import { CategoriesRepository } from "@/src/infrastructure/database/repositories/categories.repository";
import { DebtsRepository } from "@/src/infrastructure/database/repositories/debts.repository";

/**
 * Create a PlannedPaymentsService instance with all dependencies
 */
export function makePlannedPaymentsService(): PlannedPaymentsService {
  const repository = new PlannedPaymentsRepository();
  const accountsRepository = new AccountsRepository();
  const categoriesRepository = new CategoriesRepository();
  const debtsRepository = new DebtsRepository();
  return new PlannedPaymentsService(repository, accountsRepository, categoriesRepository, debtsRepository);
}

