/**
 * Mock Transactions Repository
 * Used for unit testing TransactionsService
 */

import { TransactionRow } from "@/src/infrastructure/database/repositories/transactions.repository";

export interface MockTransactionsRepository {
  findAll: jest.Mock;
  findById: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  createTransferWithLimit: jest.Mock;
}

export function createMockTransactionsRepository(): MockTransactionsRepository {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createTransferWithLimit: jest.fn(),
  };
}

export const mockTransactionRow: TransactionRow = {
  id: "test-transaction-id",
  date: new Date().toISOString().split('T')[0],
  type: "expense",
  amount: 100.50,
  account_id: "test-account-id",
  category_id: "test-category-id",
  subcategory_id: null,
  description: "encrypted-description",
  description_search: "encrypted-description",
  is_recurring: false,
  expense_type: null,
  transfer_to_id: null,
  transfer_from_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  suggested_category_id: null,
  suggested_subcategory_id: null,
  tags: null,
  receipt_url: null,
  user_id: "test-user-id",
  household_id: "test-household-id",
  deleted_at: null,

};

