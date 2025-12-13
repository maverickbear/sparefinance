/**
 * Domain types for financial events
 * Pure TypeScript types with no external dependencies
 * 
 * SIMPLIFIED: Renamed from "Planned Payments" to "Financial Events"
 * This better reflects that these are future financial events (income, expense, transfer)
 * not just "payments"
 */

export const FINANCIAL_EVENT_HORIZON_DAYS = 90; // Same as PLANNED_HORIZON_DAYS

// Backward compatibility: export old name
export const PLANNED_HORIZON_DAYS = FINANCIAL_EVENT_HORIZON_DAYS;

export interface BaseFinancialEvent {
  id: string;
  date: Date | string;
  type: "expense" | "income" | "transfer";
  amount: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  description: string | null;
  source: "recurring" | "debt" | "manual" | "subscription" | "goal";
  status: "scheduled" | "paid" | "skipped" | "cancelled";
  linkedTransactionId: string | null;
  debtId: string | null;
  subscriptionId: string | null;
  goalId: string | null;
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

// Backward compatibility: export old name
export type BasePlannedPayment = BaseFinancialEvent;

export interface FinancialEventFormData {
  date: Date | string;
  type: "expense" | "income" | "transfer";
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  source?: "recurring" | "debt" | "manual" | "subscription" | "goal";
  debtId?: string | null;
  subscriptionId?: string | null;
  goalId?: string | null;
}

// Backward compatibility: export old name
export type PlannedPaymentFormData = FinancialEventFormData;
