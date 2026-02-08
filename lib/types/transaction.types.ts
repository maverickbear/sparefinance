/**
 * Shared TypeScript types for transactions
 * Centralized to ensure consistency across the application
 */

export interface TransactionAmount {
  amount: number;
  encrypted?: string; // Original encrypted value if needed
}

export interface BaseTransaction {
  id: string;
  date: string | Date;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  accountId: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  recurring?: boolean;
  expenseType?: string | null;
  transferToId?: string | null;
  transferFromId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  suggestedCategoryId?: string | null;
  suggestedSubcategoryId?: string | null;
}

export interface TransactionWithRelations extends BaseTransaction {
  account?: {
    id: string;
    name: string;
    type: string;
    balance?: number;
  } | null;
  category?: {
    id: string;
    name: string;
    type?: "income" | "expense";
  } | null;
  subcategory?: {
    id: string;
    name: string;
    logo?: string | null;
  } | null;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  type?: 'income' | 'expense' | 'transfer';
  search?: string;
  recurring?: boolean;
  page?: number;
  limit?: number;
}

export interface TransactionQueryResult {
  transactions: TransactionWithRelations[];
  total: number;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  count: number;
  byCategory: Record<string, number>;
  byAccount: Record<string, number>;
}

export interface UpcomingTransaction {
  id: string;
  date: Date;
  type: string;
  amount: number;
  description?: string;
  account?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  originalDate: Date;
  isDebtPayment?: boolean;
}

