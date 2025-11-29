/**
 * Goals Factory
 * Dependency injection factory for GoalsService
 */

import { GoalsService } from "./goals.service";
import { GoalsRepository } from "../../infrastructure/database/repositories/goals.repository";

/**
 * Create a GoalsService instance with all dependencies
 */
export function makeGoalsService(): GoalsService {
  const repository = new GoalsRepository();
  return new GoalsService(repository);
}

