/**
 * Accounts Service
 * Business logic for account management
 */

import { AccountsRepository } from "../../infrastructure/database/repositories/accounts.repository";
import { AccountsMapper } from "./accounts.mapper";
import { AccountFormData } from "../../domain/accounts/accounts.validations";
import { AccountWithBalance, BaseAccount } from "../../domain/accounts/accounts.types";
import { createServerClient } from "../../infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { guardAccountLimit, throwIfNotAllowed, getCurrentUserId } from "@/src/application/shared/feature-guard";
import { requireAccountOwnership } from "@/src/infrastructure/utils/security";
import { logger } from "@/src/infrastructure/utils/logger";
import { invalidateAccountCaches, invalidateTransactionCaches } from "../../infrastructure/cache/cache.manager";
import { revalidateTag } from "next/cache";

// Simple in-memory cache for request deduplication
const requestCache = new Map<string, { promise: Promise<AccountWithBalance[]>; timestamp: number }>();
const CACHE_TTL = 2000; // 2 seconds

function cleanAccountsCache() {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      requestCache.delete(key);
    }
  }
}

export class AccountsService {
  constructor(private repository: AccountsRepository) {}

  /**
   * Get all accounts for the current user with balances
   */
  async getAccounts(
    accessToken?: string,
    refreshToken?: string,
    options?: { includeHoldings?: boolean }
  ): Promise<AccountWithBalance[]> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const includeHoldings = options?.includeHoldings ?? true;

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error("[AccountsService] User not authenticated:", authError?.message);
      return [];
    }

    // Request deduplication
    const cacheKey = `accounts:${user.id}:${includeHoldings ? 'with-holdings' : 'no-holdings'}`;
    const cached = requestCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return await cached.promise;
    }

    // Clean up expired entries (1% chance)
    if (Math.random() < 0.01) {
      cleanAccountsCache();
    }

    // Create new request promise
    const requestPromise = this.fetchAccountsInternal(supabase, user.id, includeHoldings, accessToken, refreshToken);

    // Store in cache
    requestCache.set(cacheKey, { promise: requestPromise, timestamp: now });

    // Clean up after TTL expires
    setTimeout(() => {
      requestCache.delete(cacheKey);
    }, CACHE_TTL);

    return await requestPromise;
  }

  private async fetchAccountsInternal(
    supabase: any,
    userId: string,
    includeHoldings: boolean,
    accessToken?: string,
    refreshToken?: string
  ): Promise<AccountWithBalance[]> {
    logger.debug("[AccountsService] Fetching accounts for user:", userId);

    // Fetch accounts from repository
    const accountRows = await this.repository.findAll(accessToken, refreshToken);

    if (accountRows.length === 0) {
      return [];
    }

    // Calculate today's end date
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();
    const todayEnd = new Date(todayYear, todayMonth, todayDay, 23, 59, 59, 999);

    // Get transactions for balance calculation
    const accountIds = accountRows.map(row => row.id);
    const transactions = await this.repository.getTransactionsForBalance(accountIds, todayEnd);

    // Calculate balances using optimized service
    const { decryptTransactionsBatch } = await import("@/lib/utils/transaction-encryption");
    const { calculateAccountBalances } = await import("@/lib/services/balance-calculator");

    // Decrypt transactions in batch
    const decryptedTransactions = decryptTransactionsBatch(transactions || []);

    // Map accounts to format expected by balance calculator
    const accountsWithInitialBalance = accountRows.map(row => ({
      ...AccountsMapper.toDomain(row),
      initialBalance: row.initialBalance ?? 0,
      balance: 0,
    }));

    // Calculate all balances in one efficient pass
    const balances = calculateAccountBalances(
      accountsWithInitialBalance as any,
      decryptedTransactions as any,
      todayEnd
    );

    // Handle investment accounts separately
    const investmentAccounts = accountRows.filter(row => row.type === "investment");
    if (investmentAccounts.length > 0) {
      await this.calculateInvestmentBalances(
        supabase,
        investmentAccounts,
        balances,
        includeHoldings,
        accessToken,
        refreshToken
      );
    }

    // Get account owners
    const accountOwnersMap = new Map<string, string[]>();
    for (const account of accountRows) {
      const owners = await this.repository.getAccountOwners(account.id);
      accountOwnersMap.set(account.id, owners.map(o => o.ownerId));
    }

    // Get owner names for household names
    const allOwnerIds = new Set<string>();
    accountOwnersMap.forEach(ownerIds => {
      ownerIds.forEach(id => allOwnerIds.add(id));
    });
    accountRows.forEach(row => {
      if (row.userId) allOwnerIds.add(row.userId);
    });

    const { data: owners } = await supabase
      .from("User")
      .select("id, name")
      .in("id", Array.from(allOwnerIds));

    const householdNamesMap = new Map<string, string>();
    owners?.forEach((owner: any) => {
      if (owner.id && owner.name) {
        const firstName = owner.name.split(' ')[0];
        householdNamesMap.set(owner.id, firstName);
      }
    });

    // Map to domain entities with balances
    return AccountsMapper.toDomainWithBalance(
      accountRows,
      balances,
      accountOwnersMap,
      householdNamesMap
    );
  }

  private async calculateInvestmentBalances(
    supabase: any,
    investmentAccounts: any[],
    balances: Map<string, number>,
    includeHoldings: boolean,
    accessToken?: string,
    refreshToken?: string
  ): Promise<void> {
    const investmentAccountIds = investmentAccounts.map(acc => acc.id);

    // 1. Try to get values from InvestmentAccount
    const { data: investmentAccountData } = await supabase
      .from("InvestmentAccount")
      .select("accountId, totalEquity, marketValue, cash")
      .in("accountId", investmentAccountIds)
      .not("accountId", "is", null);

    if (investmentAccountData) {
      investmentAccountData.forEach((ia: any) => {
        if (ia.accountId) {
          const totalEquity = ia.totalEquity != null ? Number(ia.totalEquity) : null;
          const marketValue = ia.marketValue != null ? Number(ia.marketValue) : 0;
          const cash = ia.cash != null ? Number(ia.cash) : 0;
          const accountValue = totalEquity ?? (marketValue + cash);
          balances.set(ia.accountId, accountValue);
        }
      });
    }

    // 2. For accounts without InvestmentAccount data, try AccountInvestmentValue
    const accountsWithoutInvestmentAccount = investmentAccountIds.filter(
      (accountId: string) => !balances.has(accountId)
    );

    if (accountsWithoutInvestmentAccount.length > 0) {
      const { data: investmentValues } = await supabase
        .from("AccountInvestmentValue")
        .select("accountId, totalValue")
        .in("accountId", accountsWithoutInvestmentAccount);

      if (investmentValues) {
        investmentValues.forEach((iv: any) => {
          const totalValue = iv.totalValue != null ? Number(iv.totalValue) : 0;
          balances.set(iv.accountId, totalValue);
        });
      }
    }

    // 3. Calculate from holdings if requested
    if (includeHoldings) {
      try {
        const { getHoldings } = await import("@/lib/api/investments");
        const holdings = await getHoldings(undefined, accessToken, refreshToken);

        // Create map from InvestmentAccount.id to Account.id
        const investmentAccountMap = new Map<string, string>();
        const { data: investmentAccountsData } = await supabase
          .from("InvestmentAccount")
          .select("id, accountId")
          .in("accountId", investmentAccountIds)
          .not("accountId", "is", null);

        investmentAccountsData?.forEach((ia: any) => {
          if (ia.accountId) {
            investmentAccountMap.set(ia.id, ia.accountId);
          }
        });

        // Calculate value for each account based on holdings
        investmentAccountIds.forEach(accountId => {
          const accountHoldings = holdings.filter((h: any) => {
            if (h.accountId === accountId) return true;
            const mappedAccountId = investmentAccountMap.get(h.accountId);
            return mappedAccountId === accountId;
          });

          const holdingsValue = accountHoldings.reduce((sum: number, h: any) => {
            return sum + (h.marketValue || 0);
          }, 0);

          const existingBalance = balances.get(accountId) || 0;
          const finalBalance = holdingsValue > existingBalance ? holdingsValue : existingBalance;
          balances.set(accountId, finalBalance);
        });
      } catch (error) {
        logger.error("Error fetching holdings for account values:", error);
      }
    }

    // 4. Set to 0 for accounts without any value
    investmentAccounts.forEach((account: any) => {
      if (!balances.has(account.id)) {
        balances.set(account.id, 0);
      }
    });
  }

  /**
   * Create a new account
   */
  async createAccount(data: AccountFormData): Promise<BaseAccount> {
    const supabase = await createServerClient();

    // Get current user
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Check account limit
    const limitGuard = await guardAccountLimit(userId);
    await throwIfNotAllowed(limitGuard);

    // Generate UUID and timestamp
    const id = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    // Determine owner IDs
    const ownerIds = data.ownerIds && data.ownerIds.length > 0 ? data.ownerIds : [userId];

    // Get active household ID
    const householdId = await getActiveHouseholdId(userId);

    // Create account via repository
    const accountRow = await this.repository.create({
      id,
      name: data.name,
      type: data.type,
      creditLimit: data.type === "credit" ? data.creditLimit : null,
      initialBalance: (data.type === "checking" || data.type === "savings") ? (data.initialBalance ?? 0) : null,
      dueDayOfMonth: data.type === "credit" ? (data.dueDayOfMonth ?? null) : null,
      currencyCode: data.currencyCode || 'USD',
      userId,
      householdId,
      createdAt: now,
      updatedAt: now,
    });

    // Create account owners
    if (ownerIds.length > 0) {
      await this.repository.setAccountOwners(id, ownerIds, now);
    }

    // Invalidate cache
    revalidateTag('accounts', 'max');
    revalidateTag('dashboard', 'max');

    return AccountsMapper.toDomain(accountRow);
  }

  /**
   * Update an account
   */
  async updateAccount(id: string, data: Partial<AccountFormData>): Promise<BaseAccount> {
    // Verify ownership
    await requireAccountOwnership(id);

    const updateData: Record<string, unknown> = { ...data };
    const ownerIds = updateData.ownerIds as string[] | undefined;
    delete updateData.ownerIds;

    // Handle creditLimit based on type
    if (data.type !== undefined) {
      if (data.type === "credit") {
        updateData.creditLimit = data.creditLimit ?? null;
        updateData.initialBalance = null;
        if (data.dueDayOfMonth !== undefined) {
          updateData.dueDayOfMonth = data.dueDayOfMonth;
        }
      } else {
        updateData.creditLimit = null;
        updateData.dueDayOfMonth = null;
      }
    } else if (data.creditLimit !== undefined) {
      updateData.creditLimit = data.creditLimit;
    }

    // Handle initialBalance based on type
    if (data.type !== undefined) {
      if (data.type === "checking" || data.type === "savings") {
        updateData.initialBalance = data.initialBalance ?? 0;
      } else {
        updateData.initialBalance = null;
      }
    } else if (data.initialBalance !== undefined) {
      updateData.initialBalance = data.initialBalance;
    }

    // Handle currencyCode
    if (data.currencyCode !== undefined) {
      updateData.currencyCode = data.currencyCode || 'USD';
    }

    updateData.updatedAt = formatTimestamp(new Date());

    // Update account via repository
    const accountRow = await this.repository.update(id, updateData as any);

    // Update owners if provided
    if (ownerIds !== undefined) {
      if (ownerIds.length === 0) {
        throw new Error("At least one account owner is required");
      }
      const now = formatTimestamp(new Date());
      await this.repository.setAccountOwners(id, ownerIds, now);
    }

    // Invalidate cache
    invalidateAccountCaches();

    return AccountsMapper.toDomain(accountRow);
  }

  /**
   * Delete an account
   */
  async deleteAccount(id: string, transferToAccountId?: string): Promise<void> {
    // Verify ownership
    await requireAccountOwnership(id);

    // Transfer transactions if needed
    if (transferToAccountId) {
      await this.transferAccountTransactions(id, transferToAccountId);
    } else {
      const hasTransactions = await this.repository.hasTransactions(id);
      if (hasTransactions) {
        throw new Error("Account has associated transactions. Please select a destination account to transfer them to.");
      }
    }

    // Delete account
    await this.repository.delete(id);

    // Invalidate cache
    invalidateAccountCaches();
    invalidateTransactionCaches();
  }

  /**
   * Check if account has transactions
   */
  async hasTransactions(accountId: string): Promise<boolean> {
    // Verify account ownership
    await requireAccountOwnership(accountId);
    
    return await this.repository.hasTransactions(accountId);
  }

  /**
   * Transfer transactions from one account to another
   */
  async transferAccountTransactions(
    fromAccountId: string,
    toAccountId: string
  ): Promise<{ transferred: number }> {
    // Verify ownership of both accounts
    await requireAccountOwnership(fromAccountId);
    await requireAccountOwnership(toAccountId);

    // Transfer via repository
    const count = await this.repository.transferTransactions(fromAccountId, toAccountId);

    // Invalidate cache
    invalidateTransactionCaches();
    invalidateAccountCaches();

    return { transferred: count };
  }
}

