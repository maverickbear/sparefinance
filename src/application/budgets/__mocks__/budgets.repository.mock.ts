/**
 * Mock Budgets Repository
 * Used for unit testing BudgetsService
 */

import { BudgetRow } from "@/src/infrastructure/database/repositories/budgets.repository";

export interface MockBudgetsRepository {
  findAllByPeriod: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  getBudgetSpendingByPeriod: jest.Mock;
  findRecurringBudgetsBeforePeriod: jest.Mock;
  existsForPeriod: jest.Mock;
}

export function createMockBudgetsRepository(): MockBudgetsRepository {
  return {
    findAllByPeriod: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getBudgetSpendingByPeriod: jest.fn(),
    findRecurringBudgetsBeforePeriod: jest.fn(),
    existsForPeriod: jest.fn(),
  };
}

export const mockBudgetRow: BudgetRow = {
  id: "test-budget-id",
  period: "2025-01-01 00:00:00",
  amount: 1000.00,
  category_id: "test-category-id",
  subcategory_id: null,
  user_id: "test-user-id",
  note: null,
  is_recurring: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

