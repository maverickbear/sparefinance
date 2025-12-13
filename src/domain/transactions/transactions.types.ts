/**
 * Domain types for transactions
 * Pure TypeScript types with no external dependencies
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
  descriptionSearch?: string | null;
  tags?: string | null;
  isRecurring?: boolean;
  expenseType?: string | null;
  transferToId?: string | null;
  transferFromId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  suggestedCategoryId?: string | null;
  suggestedSubcategoryId?: string | null;
  receiptUrl?: string | null;
  userId?: string | null;
  householdId?: string | null;
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
  } | null;
  subcategory?: {
    id: string;
    name: string;
    logo?: string | null;
  } | null;
  suggestedCategory?: {
    id: string;
    name: string;
  } | null;
  suggestedSubcategory?: {
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
  isRecurring?: boolean;
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

// Alias for backward compatibility (matches client-side Transaction interface)
export interface Transaction extends Omit<BaseTransaction, 'date' | 'type'> {
  date: string; // Override to match client-side (string instead of Date)
  type: string; // Override to match client-side (string instead of union)
  expenseType?: "fixed" | "variable" | null;
  account?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  suggestedCategory?: { id: string; name: string } | null;
  suggestedSubcategory?: { id: string; name: string } | null;
}

