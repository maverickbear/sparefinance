/**
 * Shared TypeScript types for accounts
 * Centralized to ensure consistency across the application
 */

export interface BaseAccount {
  id: string;
  name: string;
  type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
  userId?: string | null;
  creditLimit?: number | null;
  initialBalance?: number | null;
  isConnected?: boolean | null;
  lastSyncedAt?: string | null;
  syncEnabled?: boolean | null;
  currencyCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
  dueDayOfMonth?: number | null;
  extraCredit?: number;
}

export interface AccountWithBalance extends BaseAccount {
  balance: number;
  householdName?: string | null;
  ownerIds?: string[];
}

export interface AccountBalance {
  accountId: string;
  balance: number;
  lastCalculatedAt: Date;
}

export interface AccountSummary {
  totalBalance: number;
  byType: Record<string, number>;
  byOwner: Record<string, number>;
  accounts: AccountWithBalance[];
}

