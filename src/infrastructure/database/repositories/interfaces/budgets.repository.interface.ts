/**
 * Budgets Repository Interface
 * Contract for budget data access
 */

import { BudgetRow, BudgetSpendingRow } from "../budgets.repository";

export interface IBudgetsRepository {
  findAllByPeriod(
    period: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetRow[]>;
  findById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetRow | null>;
  create(data: {
    id: string;
    period: string;
    amount: number;
    categoryId: string | null;
    subcategoryId: string | null;
    userId: string;
    note: string | null;
    isRecurring: boolean;
    createdAt: string;
    updatedAt: string;
  }): Promise<BudgetRow>;
  update(
    id: string,
    data: Partial<{
      period: string;
      amount: number;
      categoryId: string | null;
      subcategoryId: string | null;
      note: string | null;
      isRecurring: boolean;
      updatedAt: string;
    }>
  ): Promise<BudgetRow>;
  delete(id: string): Promise<void>;
  getBudgetSpendingByPeriod(
    period: Date,
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Map<string, BudgetSpendingRow>>;
  findRecurringBudgetsBeforePeriod(
    period: Date,
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetRow[]>;
  existsForPeriod(
    period: string,
    categoryId: string | null,
    subcategoryId: string | null,
    userId: string
  ): Promise<boolean>;
}

