/**
 * Investments Factory
 * Dependency injection factory for InvestmentsService
 */

import { InvestmentsService } from "./investments.service";
import { InvestmentsRepository } from "../../infrastructure/database/repositories/investments.repository";

/**
 * Create an InvestmentsService instance with all dependencies
 */
export function makeInvestmentsService(): InvestmentsService {
  const repository = new InvestmentsRepository();
  return new InvestmentsService(repository);
}

