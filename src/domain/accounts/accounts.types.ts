/**
 * Domain types for accounts
 * Pure TypeScript types with no external dependencies
 */

export interface BaseAccount {
  id: string;
  name: string;
  type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
  userId?: string | null;
  creditLimit?: number | null;
  initialBalance?: number | null;
  plaidItemId?: string | null;
  plaidAccountId?: string | null;
  isConnected?: boolean | null;
  lastSyncedAt?: string | null;
  syncEnabled?: boolean | null;
  plaidMask?: string | null;
  plaidOfficialName?: string | null;
  plaidVerificationStatus?: string | null;
  plaidSubtype?: string | null;
  currencyCode?: string | null;
  plaidUnofficialCurrencyCode?: string | null;
  plaidAvailableBalance?: number | null;
  plaidPersistentAccountId?: string | null;
  plaidHolderCategory?: string | null;
  plaidVerificationName?: string | null;
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

// Alias for backward compatibility (matches client-side Account interface)
export interface Account extends BaseAccount {
  balance: number;
  householdName?: string | null;
  ownerIds?: string[];
}

