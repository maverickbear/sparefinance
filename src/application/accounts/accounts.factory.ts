/**
 * Accounts Factory
 * Dependency injection factory for AccountsService
 */

import { AccountsService } from "./accounts.service";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";

/**
 * Create an AccountsService instance with all dependencies
 */
export function makeAccountsService(): AccountsService {
  const repository = new AccountsRepository();
  return new AccountsService(repository);
}

