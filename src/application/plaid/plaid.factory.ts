/**
 * Plaid Factory
 * Dependency injection factory for PlaidService
 */

import { PlaidService } from "./plaid.service";
import { PlaidRepository } from "../../infrastructure/database/repositories/plaid.repository";

/**
 * Create a PlaidService instance with all dependencies
 */
export function makePlaidService(): PlaidService {
  const repository = new PlaidRepository();
  return new PlaidService(repository);
}

