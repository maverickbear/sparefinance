/**
 * Domain types for planned payments
 * Pure TypeScript types with no external dependencies
 */

export const PLANNED_HORIZON_DAYS = 90;

export interface BasePlannedPayment {
  id: string;
  date: Date | string;
  type: "expense" | "income" | "transfer";
  amount: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  description: string | null;
  source: "recurring" | "debt" | "manual" | "subscription";
  status: "scheduled" | "paid" | "skipped" | "cancelled";
  linkedTransactionId: string | null;
  debtId: string | null;
  subscriptionId: string | null;
  userId: string;
  householdId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Enriched fields (from relations)
  account?: { id: string; name: string } | null;
  toAccount?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string; logo?: string | null } | null;
}

export interface PlannedPaymentFormData {
  date: Date | string;
  type: "expense" | "income" | "transfer";
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  source?: "recurring" | "debt" | "manual" | "subscription";
  debtId?: string | null;
  subscriptionId?: string | null;
}

