/**
 * Domain types for budgets
 * Pure TypeScript types with no external dependencies
 */

export interface BaseBudget {
  id: string;
  period: string;
  amount: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  groupId?: string | null;
  userId: string;
  note?: string | null;
  isRecurring: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BudgetWithRelations extends BaseBudget {
  actualSpend?: number;
  percentage?: number;
  status?: "ok" | "warning" | "over";
  displayName?: string;
  category?: {
    id: string;
    name: string;
    groupId?: string;
    group?: { id: string; name: string } | null;
  } | null;
  subcategory?: { id: string; name: string } | null;
  group?: { id: string; name: string } | null;
  budgetCategories?: Array<{
    id: string;
    budgetId: string;
    categoryId: string;
    createdAt?: string;
    category?: { id: string; name: string } | null;
  }>;
  budgetSubcategories?: Array<{
    id: string;
    budgetId: string;
    subcategoryId: string;
    createdAt?: string;
    subcategory?: { id: string; name: string } | null;
  }>;
  // Deprecated: Use groupId and group instead
  macroId?: string | null;
  macro?: { id: string; name: string } | null;
}

// Alias for backward compatibility (matches lib/api/budgets.ts interface)
export interface Budget extends Omit<BaseBudget, 'userId' | 'isRecurring'> {
  userId?: string | null;
  isRecurring?: boolean;
  actualSpend?: number;
  percentage?: number;
  status?: "ok" | "warning" | "over";
  displayName?: string;
}

