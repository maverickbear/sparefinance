/**
 * Accounts Repository Interface
 * Contract for account data access
 */

import { AccountRow, AccountOwnerRow } from "../accounts.repository";

export interface IAccountsRepository {
  findAll(
    accessToken?: string,
    refreshToken?: string,
    options?: { selectFields?: string[] }
  ): Promise<AccountRow[]>;
  findById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<AccountRow | null>;
  findByIds(
    ids: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<AccountRow[]>;
  create(data: {
    id: string;
    name: string;
    type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
    userId: string;
    creditLimit?: number | null;
    initialBalance?: number | null;
    dueDayOfMonth?: number | null;
    currencyCode?: string | null;
    householdId?: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<AccountRow>;
  update(
    id: string,
    data: Partial<{
      name: string;
      type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
      creditLimit: number | null;
      initialBalance: number | null;
      dueDayOfMonth: number | null;
      currencyCode: string | null;
      updatedAt: string;
    }>
  ): Promise<AccountRow>;
  delete(id: string): Promise<void>;
  getTransactionsForBalance(
    accountIds: string[],
    endDate: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{
    accountId: string;
    type: string;
    amount: unknown;
    date: string;
  }>>;
  hasTransactions(accountId: string): Promise<boolean>;
  getAccountOwners(
    accountId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<AccountOwnerRow[]>;
  setAccountOwners(accountId: string, ownerIds: string[], now: string): Promise<void>;
  getUserNamesByIds(
    userIds: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ id: string; name: string | null }>>;
  transferTransactions(fromAccountId: string, toAccountId: string): Promise<number>;
}

