/**
 * Transactions Factory
 * Dependency injection factory for TransactionsService
 */

import { TransactionsService } from "./transactions.service";
import { TransactionsRepository } from "../../infrastructure/database/repositories/transactions.repository";

/**
 * Create a TransactionsService instance with all dependencies
 */
export function makeTransactionsService(): TransactionsService {
  const repository = new TransactionsRepository();
  return new TransactionsService(repository);
}

