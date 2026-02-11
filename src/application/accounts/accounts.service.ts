/**
 * Accounts Service
 * Business logic for account management
 */

import { IAccountsRepository } from "@/src/infrastructure/database/repositories/interfaces/accounts.repository.interface";
import { AccountsMapper } from "./accounts.mapper";
import { AccountFormData } from "../../domain/accounts/accounts.validations";
import { AccountWithBalance, BaseAccount } from "../../domain/accounts/accounts.types";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { makeMembersService } from "../members/members.factory";
import { guardAccountLimit, throwIfNotAllowed, getCurrentUserId } from "@/src/application/shared/feature-guard";
import { requireAccountOwnership } from "@/src/infrastructure/utils/security";
import { logger } from "@/src/infrastructure/utils/logger";
import { AppError } from "../shared/app-error";

export class AccountsService {
  constructor(private repository: IAccountsRepository) {}

  /**
   * Get all accounts for the current user with balances
   * Note: This method does not use cache directives - use getAccountsForDashboard() for cached access
   */
  async getAccounts(
    accessToken?: string,
    refreshToken?: string,
    options?: { includeHoldings?: boolean }
  ): Promise<AccountWithBalance[]> {
    // Get current user ID
    const userId = await getCurrentUserId();
    if (!userId) {
      // In server components, this can happen during SSR - return empty array gracefully
      // Don't log as error since this is expected in some contexts
      return [];
    }

    const includeHoldings = options?.includeHoldings ?? true;
    return await this.fetchAccountsInternal(userId, includeHoldings, accessToken, refreshToken);
  }

  private async fetchAccountsInternal(
    userId: string,
    includeHoldings: boolean,
    accessToken?: string,
    refreshToken?: string
  ): Promise<AccountWithBalance[]> {
    // Fetch accounts from repository
    const accountRows = await this.repository.findAll(accessToken, refreshToken);

    if (accountRows.length === 0) {
      logger.debug("[AccountsService] No accounts found for user:", userId);
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
    const transactions = await this.repository.getTransactionsForBalance(accountIds, todayEnd, accessToken, refreshToken);

    // Calculate balances using optimized service
    const { decryptTransactionsBatch } = await import("@/lib/utils/transaction-encryption");
    const { calculateAccountBalances } = await import("@/lib/services/balance-calculator");

    // Decrypt transactions in batch
    const decryptedTransactions = decryptTransactionsBatch(transactions || []);

    // Map accounts to format expected by balance calculator
    const accountsWithInitialBalance = accountRows.map(row => ({
      ...AccountsMapper.toDomain(row),
      initialBalance: row.initial_balance ?? 0,
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
      const owners = await this.repository.getAccountOwners(account.id, accessToken, refreshToken);
      accountOwnersMap.set(account.id, owners.map(o => o.owner_id));
    }

    // Get owner names for household names
    const allOwnerIds = new Set<string>();
    accountOwnersMap.forEach(ownerIds => {
      ownerIds.forEach(id => allOwnerIds.add(id));
    });
    accountRows.forEach(row => {
      if (row.user_id) allOwnerIds.add(row.user_id);
    });

    // Get owner names from repository
    const owners = await this.repository.getUserNamesByIds(Array.from(allOwnerIds), accessToken, refreshToken);

    const householdNamesMap = new Map<string, string>();
    owners.forEach((owner) => {
      if (owner.id && owner.name) {
        const firstName = owner.name.split(' ')[0];
        householdNamesMap.set(owner.id, firstName);
      }
    });

    // Map to domain entities with balances
    const accountsWithBalance = AccountsMapper.toDomainWithBalance(
      accountRows,
      balances,
      accountOwnersMap,
      householdNamesMap
    );
    
    return accountsWithBalance;
  }

  private async calculateInvestmentBalances(
    investmentAccounts: any[],
    balances: Map<string, number>,
    _includeHoldings: boolean,
    _accessToken?: string,
    _refreshToken?: string
  ): Promise<void> {
    // Investment/portfolio feature removed - use transaction-based balance only (already in balances from main flow)
    // Set to 0 for investment accounts that have no balance from transactions
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
    // Get current user
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
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
    const membersService = makeMembersService();
    const householdId = await membersService.getActiveHouseholdId(userId);

    // Create account via repository (repository maps camelCase to snake_case internally)
    const accountRow = await this.repository.create({
      id,
      name: data.name,
      type: data.type,
      userId,
      creditLimit: data.type === "credit" ? data.creditLimit : null,
      initialBalance: (data.type === "checking" || data.type === "savings" || data.type === "cash" || data.type === "other") ? (data.initialBalance ?? 0) : null,
      dueDayOfMonth: data.type === "credit" ? (data.dueDayOfMonth ?? null) : null,
      currencyCode: data.currencyCode || 'USD',
      householdId: householdId,
      createdAt: now,
      updatedAt: now,
    });

    // Create account owners
    if (ownerIds.length > 0) {
      await this.repository.setAccountOwners(id, ownerIds, now);
    }


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
      if (data.type === "checking" || data.type === "savings" || data.type === "cash" || data.type === "other") {
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
        throw new AppError("At least one account owner is required", 400);
      }
      const now = formatTimestamp(new Date());
      await this.repository.setAccountOwners(id, ownerIds, now);
    }


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
        throw new AppError("Account has associated transactions. Please select a destination account to transfer them to.", 400);
      }
    }

    // Delete account
    await this.repository.delete(id);
  }

  /**
   * Get account by ID with institution information
   */
  async getAccountById(id: string): Promise<BaseAccount & { institutionName?: string | null; institutionLogo?: string | null }> {
    // Verify account ownership
    await requireAccountOwnership(id);
    
    // Get account from repository
    const accountRow = await this.repository.findById(id);
    
    if (!accountRow) {
      throw new AppError("Account not found", 404);
    }
    
    const account = AccountsMapper.toDomain(accountRow);
    
    return account;
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


    return { transferred: count };
  }

  /**
   * Set an account as the default account
   */
  async setDefaultAccount(accountId: string): Promise<void> {
    // Verify account ownership
    await requireAccountOwnership(accountId);
    
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    await this.repository.setDefaultAccount(accountId, userId);
  }
}

