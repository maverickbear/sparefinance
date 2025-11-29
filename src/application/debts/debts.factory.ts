/**
 * Debts Factory
 * Dependency injection factory for DebtsService
 */

import { DebtsService } from "./debts.service";
import { DebtsRepository } from "../../infrastructure/database/repositories/debts.repository";

/**
 * Create a DebtsService instance with all dependencies
 */
export function makeDebtsService(): DebtsService {
  const repository = new DebtsRepository();
  return new DebtsService(repository);
}

