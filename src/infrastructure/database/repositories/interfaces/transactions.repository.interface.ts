/**
 * Transactions Repository Interface
 * Contract for transaction data access
 */

import { TransactionRow, TransactionFilters } from "../transactions.repository";

export interface ITransactionsRepository {
  findAll(
    filters?: TransactionFilters,
    accessToken?: string,
    refreshToken?: string
  ): Promise<TransactionRow[]>;
  findById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<TransactionRow | null>;
  findByIds(
    ids: string[],
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<TransactionRow & { account?: { id: string; name: string } | null }>>;
  count(
    filters?: TransactionFilters,
    accessToken?: string,
    refreshToken?: string
  ): Promise<number>;
  create(data: {
    id: string;
    date: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    accountId: string;
    categoryId: string | null;
    subcategoryId: string | null;
    description: string | null;
    isRecurring: boolean;
    expenseType: string | null;
    transferToId: string | null;
    transferFromId: string | null;
    userId: string;
    householdId: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<TransactionRow>;
  update(
    id: string,
    data: Partial<{
      date: string;
      type: 'income' | 'expense' | 'transfer';
      amount: number;
      accountId: string;
      categoryId: string | null;
      subcategoryId: string | null;
      description: string | null;
      isRecurring: boolean;
      expenseType: string | null;
      transferToId: string | null;
      transferFromId: string | null;
      updatedAt: string;
      receiptUrl: string | null;
    }>
  ): Promise<TransactionRow>;
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  deleteMultiple(ids: string[]): Promise<void>;
  softDeleteMultiple(ids: string[]): Promise<void>;
  restore(ids: string[]): Promise<void>;
  createTransferWithLimit(data: {
    userId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    description: string | null;
    descriptionSearch: string | null;
    isRecurring: boolean;
    maxTransactions: number;
  }): Promise<{ id: string } | null>;
  getTransactionsForBalance(accountId: string, endDate: Date): Promise<Array<{
    accountId: string;
    type: string;
    amount: number;
    date: string;
  }>>;
  findByIdWithSuggestions(id: string): Promise<TransactionRow | null>;
  clearSuggestions(id: string): Promise<TransactionRow>;
  findUncategorizedForSuggestions(
    userId: string,
    limit?: number
  ): Promise<Array<{
    id: string;
    description: string | null;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    userId: string | null;
  }>>;
  updateSuggestions(
    id: string,
    data: {
      suggestedCategoryId?: string | null;
      suggestedSubcategoryId?: string | null;
    }
  ): Promise<TransactionRow>;
  findMonthlyAggregates(
    startDate: Date,
    endDate: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ month: string; income: number; expenses: number }>>;
}

