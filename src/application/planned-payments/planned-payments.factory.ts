/**
 * Planned Payments Factory
 * Dependency injection factory for PlannedPaymentsService
 */

import { PlannedPaymentsService } from "./planned-payments.service";
import { PlannedPaymentsRepository } from "@/src/infrastructure/database/repositories/planned-payments.repository";

/**
 * Create a PlannedPaymentsService instance with all dependencies
 */
export function makePlannedPaymentsService(): PlannedPaymentsService {
  const repository = new PlannedPaymentsRepository();
  return new PlannedPaymentsService(repository);
}

