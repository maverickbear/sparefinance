/**
 * Plaid Service
 * Business logic for Plaid integration
 */

import { PlaidItemsRepository } from '@/src/infrastructure/database/repositories/plaid-items.repository';
import { AccountsRepository } from '@/src/infrastructure/database/repositories/accounts.repository';
import { TransactionsRepository } from '@/src/infrastructure/database/repositories/transactions.repository';
import { PlaidMapper } from './plaid.mapper';
import { makeMembersService } from '@/src/application/members/members.factory';
import { getActiveHouseholdId } from '@/lib/utils/household';
import { formatTimestamp } from '@/src/infrastructure/utils/timestamp';
import { encryptDescription, normalizeDescription } from '@/src/infrastructure/utils/transaction-encryption';
import {
  createLinkToken,
  exchangePublicToken,
  getAccounts,
  syncTransactions,
} from '@/src/infrastructure/external/plaid/plaid-client';
import {
  LinkTokenRequest,
  LinkTokenResponse,
  ExchangePublicTokenRequest,
  ExchangePublicTokenResponse,
  PlaidItem,
  PlaidAccount,
} from '@/src/domain/plaid/plaid.types';
import { logger } from '@/lib/utils/logger';
import { AppError } from '@/src/application/shared/app-error';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { randomUUID } from 'crypto';

export class PlaidService {
  constructor(
    private plaidItemsRepository: PlaidItemsRepository,
    private accountsRepository: AccountsRepository,
    private transactionsRepository: TransactionsRepository
  ) {}

  /**
   * Create a link token for Plaid Link
   */
  async createLinkToken(userId: string): Promise<LinkTokenResponse> {
    try {
      const request: LinkTokenRequest = {
        userId,
        clientName: 'Spare Finance',
        countryCodes: ['US', 'CA'],
        products: ['transactions', 'auth'],
      };

      return await createLinkToken(request);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[PlaidService] Error creating link token:', {
        userId,
        error: errorMessage,
      });
      throw new AppError('Failed to create link token', 500);
    }
  }

  /**
   * Exchange public token for access token and create plaid item
   */
  async exchangePublicToken(
    publicToken: string,
    userId: string
  ): Promise<{
    itemId: string;
    accounts: PlaidAccount[];
    manualAccountsDetected: Array<{ id: string; name: string; type: string }>;
    createdAccounts: Array<{ id: string; name: string; type: string }>;
  }> {
    try {
      // Exchange public token for access token
      const exchangeRequest: ExchangePublicTokenRequest = {
        publicToken,
        userId,
      };

      const exchangeResponse: ExchangePublicTokenResponse = await exchangePublicToken(exchangeRequest);

      // Check if item already exists
      const existingItem = await this.plaidItemsRepository.findByItemId(exchangeResponse.itemId);

      if (existingItem) {
        // Update existing item
        await this.plaidItemsRepository.update(exchangeResponse.itemId, {
          accessToken: exchangeResponse.accessToken,
          status: 'good',
          errorCode: null,
          errorMessage: null,
          lastSuccessfulUpdate: new Date(),
        });
      } else {
        // Create new item
        await this.plaidItemsRepository.create({
          userId,
          itemId: exchangeResponse.itemId,
          accessToken: exchangeResponse.accessToken,
          institutionId: exchangeResponse.institutionId,
          institutionName: exchangeResponse.institutionName,
          status: 'good',
        });
      }

      // Get accounts from Plaid
      const plaidAccounts = await getAccounts(exchangeResponse.accessToken);

      // Get item ID for account_integrations
      const item = await this.plaidItemsRepository.findByItemId(exchangeResponse.itemId);
      if (!item) {
        throw new AppError('Plaid item not found after creation', 500);
      }

      // Get household ID
      const membersService = makeMembersService();
      const householdId = await membersService.getActiveHouseholdId(userId);

      // Create/update accounts in our system
      const createdAccounts: Array<{ id: string; name: string; type: string }> = [];
      const now = formatTimestamp(new Date());

      for (const plaidAccount of plaidAccounts) {
        try {
          // Map Plaid account type to our account type
          const accountType = this.mapPlaidAccountTypeToOurType(plaidAccount.type, plaidAccount.subtype);

          // Check if account already exists (by plaid_account_id)
          const supabase = await createServerClient();
          const { data: existingIntegration } = await supabase
            .from('account_integrations')
            .select('account_id')
            .eq('plaid_account_id', plaidAccount.accountId)
            .single();

          let accountId: string;

          if (existingIntegration) {
            // Account already exists, update it
            accountId = existingIntegration.account_id;
            
            // Update account_integrations
            await supabase
              .from('account_integrations')
              .update({
                plaid_item_id: item.id,
                plaid_account_id: plaidAccount.accountId,
                plaid_mask: plaidAccount.mask,
                plaid_official_name: plaidAccount.officialName,
                plaid_subtype: plaidAccount.subtype,
                plaid_verification_status: plaidAccount.verificationStatus,
                plaid_available_balance: plaidAccount.balances.available,
                plaid_persistent_account_id: plaidAccount.persistentAccountId,
                plaid_holder_category: plaidAccount.holderCategory,
                is_connected: true,
                sync_enabled: true,
                updated_at: now,
              })
              .eq('account_id', accountId);
          } else {
            // Create new account
            accountId = randomUUID();
            const accountName = plaidAccount.officialName || plaidAccount.name;

            // Create account (using camelCase - repository maps to snake_case internally)
            await this.accountsRepository.create({
              id: accountId,
              name: accountName,
              type: accountType,
              userId: userId,
              creditLimit: accountType === 'credit' ? (plaidAccount.balances.limit || null) : null,
              initialBalance: accountType === 'investment' ? null : (plaidAccount.balances.current || 0),
              currencyCode: plaidAccount.balances.isoCurrencyCode || 'USD',
              householdId: householdId,
              createdAt: now,
              updatedAt: now,
            });

            // Create account owner
            await this.accountsRepository.setAccountOwners(accountId, [userId], now);

            // Create account_integrations record
            await supabase
              .from('account_integrations')
              .insert({
                account_id: accountId,
                plaid_item_id: item.id,
                plaid_account_id: plaidAccount.accountId,
                plaid_mask: plaidAccount.mask,
                plaid_official_name: plaidAccount.officialName,
                plaid_subtype: plaidAccount.subtype,
                plaid_verification_status: plaidAccount.verificationStatus,
                plaid_available_balance: plaidAccount.balances.available,
                plaid_persistent_account_id: plaidAccount.persistentAccountId,
                plaid_holder_category: plaidAccount.holderCategory,
                is_connected: true,
                sync_enabled: true,
                created_at: now,
                updated_at: now,
              });

            createdAccounts.push({
              id: accountId,
              name: accountName,
              type: accountType,
            });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('[PlaidService] Error creating account from Plaid', {
            plaidAccountId: plaidAccount.accountId,
            error: errorMessage,
          });
          // Continue with other accounts
        }
      }

      // Detect manual accounts from the same institution
      const manualAccountsDetected = await this.detectManualAccountsToReplace(
        exchangeResponse.institutionId,
        userId
      );

      return {
        itemId: exchangeResponse.itemId,
        accounts: plaidAccounts,
        manualAccountsDetected,
        createdAccounts,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = (error as { response?: { data?: { error_type?: string; error_code?: string } } })?.response?.data;
      logger.error('[PlaidService] Error exchanging public token:', {
        userId,
        error: errorMessage,
        errorType: errorResponse?.error_type,
        errorCode: errorResponse?.error_code,
      });
      throw new AppError('Failed to exchange public token', 500);
    }
  }

  /**
   * Detect manual accounts from the same institution
   * Returns list of accounts that could be replaced
   * Does NOT replace automatically - frontend decides
   */
  async detectManualAccountsToReplace(
    institutionId: string | null,
    userId: string
  ): Promise<Array<{ id: string; name: string; type: string }>> {
    if (!institutionId) {
      return [];
    }

    try {
      // Filter accounts that:
      // 1. Are manual (no plaid_account_id)
      // 2. Match the institution (we'd need institution mapping - simplified for now)
      // For now, we'll return empty array and implement proper matching later
      
      // TODO: Implement proper institution matching logic
      // This would require mapping institution names/IDs to account names
      // const accountRows = await this.accountsRepository.findAll();
      
      return [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[PlaidService] Error detecting manual accounts:', {
        institutionId,
        userId,
        error: errorMessage,
      });
      // Don't throw - return empty array if detection fails
      return [];
    }
  }

  /**
   * Get item status
   */
  async getItemStatus(itemId: string): Promise<PlaidItem | null> {
    try {
      const item = await this.plaidItemsRepository.findByItemId(itemId);
      if (!item) {
        return null;
      }

      return PlaidMapper.toDomain(item);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[PlaidService] Error getting item status:', {
        itemId,
        error: errorMessage,
      });
      throw new AppError('Failed to get item status', 500);
    }
  }

  /**
   * Disconnect a plaid item
   * Marks accounts as disconnected (soft delete)
   */
  async disconnectItem(itemId: string): Promise<void> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const item = await this.plaidItemsRepository.findByItemId(itemId);
      if (!item) {
        throw new AppError('Plaid item not found', 404);
      }

      // Verify ownership
      if (item.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      // Delete the item (cascade will handle account_integrations)
      await this.plaidItemsRepository.delete(itemId);

      // Update account_integrations to mark accounts as disconnected
      const supabase = await createServerClient();
      await supabase
        .from('account_integrations')
        .update({
          is_connected: false,
          sync_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('plaid_item_id', itemId);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[PlaidService] Error disconnecting item:', {
        itemId,
        error: errorMessage,
      });
      throw new AppError('Failed to disconnect item', 500);
    }
  }

  /**
   * Handle Plaid error
   * Marks status and error info, does NOT auto-resolve
   */
  async handlePlaidError(
    itemId: string,
    error: {
      errorType: string;
      errorCode: string;
      errorMessage: string;
    }
  ): Promise<void> {
    try {
      const mappedStatus = this.mapErrorToStatus(error.errorCode);
      const mappedErrorCode = PlaidMapper.mapErrorCode(error.errorCode);

      await this.plaidItemsRepository.update(itemId, {
        status: mappedStatus,
        errorCode: mappedErrorCode,
        errorMessage: error.errorMessage,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[PlaidService] Error handling Plaid error:', {
        itemId,
        error: errorMessage,
      });
      // Don't throw - error handling should be resilient
    }
  }

  /**
   * Sync all accounts for a Plaid item
   * Implements lock mechanism to prevent concurrent syncs
   */
  async syncItem(itemId: string): Promise<{
    transactionsCreated: number;
    transactionsSkipped: number;
    accountsSynced: number;
  }> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    // Get item
    const item = await this.plaidItemsRepository.findByItemId(itemId);
    if (!item) {
      throw new AppError('Plaid item not found', 404);
    }

    // Verify ownership
    if (item.user_id !== userId) {
      throw new AppError('Unauthorized', 403);
    }

    // Check lock mechanism
    const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const now = new Date();

    if (item.is_syncing && item.sync_started_at) {
      const syncStartedAt = new Date(item.sync_started_at);
      const lockAge = now.getTime() - syncStartedAt.getTime();

      if (lockAge < LOCK_TIMEOUT_MS) {
        throw new AppError('Sync already in progress', 409);
      } else {
        // Stale lock - clear it
        logger.warn('[PlaidService] Clearing stale sync lock', {
          itemId,
          lockAge: lockAge / 1000, // seconds
        });
      }
    }

    // Set lock
    await this.plaidItemsRepository.update(itemId, {
      isSyncing: true,
      syncStartedAt: now,
    });

    let transactionsCreated = 0;
    let transactionsSkipped = 0;
    let accountsSynced = 0;

    try {
      // Get access token
      const accessToken = await this.plaidItemsRepository.getAccessToken(itemId);
      if (!accessToken) {
        throw new AppError('Failed to get access token', 500);
      }

      // Get accounts from Plaid
      const plaidAccounts = await getAccounts(accessToken);

      // Calculate date range for incremental sync
      const endDate = new Date();
      const startDate = item.last_successful_update
        ? new Date(item.last_successful_update)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago if no last update

      // Sync each account
      for (const plaidAccount of plaidAccounts) {
        try {
          const result = await this.syncAccountInternal(
            itemId,
            plaidAccount.accountId,
            accessToken,
            startDate,
            endDate,
            userId
          );
          transactionsCreated += result.transactionsCreated;
          transactionsSkipped += result.transactionsSkipped;
          accountsSynced++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('[PlaidService] Error syncing account', {
            itemId,
            plaidAccountId: plaidAccount.accountId,
            error: errorMessage,
          });
          // Continue with other accounts
        }
      }

      // Update last successful update
      await this.plaidItemsRepository.update(itemId, {
        lastSuccessfulUpdate: now,
        status: 'good',
        errorCode: null,
        errorMessage: null,
      });

      return {
        transactionsCreated,
        transactionsSkipped,
        accountsSynced,
      };
    } catch (error: unknown) {
      // Handle Plaid errors
      const errorResponse = (error as { response?: { data?: { error_code?: string; error_type?: string; error_message?: string } } })?.response?.data;
      if (errorResponse?.error_code) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.handlePlaidError(itemId, {
          errorType: errorResponse.error_type || 'API_ERROR',
          errorCode: errorResponse.error_code,
          errorMessage: errorResponse.error_message || errorMessage,
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[PlaidService] Error syncing item:', {
        itemId,
        error: errorMessage,
      });
      throw error;
    } finally {
      // Always clear lock
      await this.plaidItemsRepository.update(itemId, {
        isSyncing: false,
        syncStartedAt: null,
      });
    }
  }

  /**
   * Sync item for webhook (no authentication required)
   * Gets userId from the item itself
   */
  async syncItemForWebhook(itemId: string): Promise<{
    transactionsCreated: number;
    transactionsSkipped: number;
    accountsSynced: number;
  }> {
    // Get item to get userId
    const item = await this.plaidItemsRepository.findByItemId(itemId);
    if (!item) {
      throw new AppError('Plaid item not found', 404);
    }

    // Use the item's userId instead of requiring authentication
    // Temporarily bypass auth check by directly calling sync logic
    // We'll replicate the sync logic here but without auth requirement
    
    // Check lock mechanism
    const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const now = new Date();

    if (item.is_syncing && item.sync_started_at) {
      const syncStartedAt = new Date(item.sync_started_at);
      const lockAge = now.getTime() - syncStartedAt.getTime();

      if (lockAge < LOCK_TIMEOUT_MS) {
        logger.info('[PlaidService] Sync already in progress, skipping webhook sync', {
          itemId,
          lockAge: lockAge / 1000, // seconds
        });
        return {
          transactionsCreated: 0,
          transactionsSkipped: 0,
          accountsSynced: 0,
        };
      } else {
        // Stale lock - clear it
        logger.warn('[PlaidService] Clearing stale sync lock for webhook', {
          itemId,
          lockAge: lockAge / 1000, // seconds
        });
      }
    }

    // Set lock
    await this.plaidItemsRepository.update(itemId, {
      isSyncing: true,
      syncStartedAt: now,
    });

    let transactionsCreated = 0;
    let transactionsSkipped = 0;
    let accountsSynced = 0;

    try {
      // Get access token
      const accessToken = await this.plaidItemsRepository.getAccessToken(itemId);
      if (!accessToken) {
        throw new AppError('Failed to get access token', 500);
      }

      // Get accounts from Plaid
      const plaidAccounts = await getAccounts(accessToken);

      // Calculate date range for incremental sync
      const endDate = new Date();
      const startDate = item.last_successful_update
        ? new Date(item.last_successful_update)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago if no last update

      // Sync each account
      for (const plaidAccount of plaidAccounts) {
        try {
          const result = await this.syncAccountInternal(
            itemId,
            plaidAccount.accountId,
            accessToken,
            startDate,
            endDate,
            item.user_id
          );
          transactionsCreated += result.transactionsCreated;
          transactionsSkipped += result.transactionsSkipped;
          accountsSynced++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('[PlaidService] Error syncing account from webhook', {
            itemId,
            plaidAccountId: plaidAccount.accountId,
            error: errorMessage,
          });
          // Continue with other accounts
        }
      }

      // Update last successful update
      await this.plaidItemsRepository.update(itemId, {
        lastSuccessfulUpdate: now,
        status: 'good',
        errorCode: null,
        errorMessage: null,
      });

      return {
        transactionsCreated,
        transactionsSkipped,
        accountsSynced,
      };
    } catch (error: unknown) {
      // Handle Plaid errors
      const errorResponse = (error as { response?: { data?: { error_code?: string; error_type?: string; error_message?: string } } })?.response?.data;
      if (errorResponse?.error_code) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.handlePlaidError(itemId, {
          errorType: errorResponse.error_type || 'API_ERROR',
          errorCode: errorResponse.error_code,
          errorMessage: errorResponse.error_message || errorMessage,
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[PlaidService] Error syncing item from webhook:', {
        itemId,
        error: errorMessage,
      });
      throw error;
    } finally {
      // Always clear lock
      await this.plaidItemsRepository.update(itemId, {
        isSyncing: false,
        syncStartedAt: null,
      });
    }
  }

  /**
   * Sync a specific account
   */
  async syncAccount(accountId: string): Promise<{
    transactionsCreated: number;
    transactionsSkipped: number;
  }> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    // Get account and find associated Plaid item
    const account = await this.accountsRepository.findById(accountId);
    if (!account) {
      throw new AppError('Account not found', 404);
    }

    const supabase = await createServerClient();
    const { data: integration } = await supabase
      .from('account_integrations')
      .select('plaid_item_id, plaid_account_id')
      .eq('account_id', accountId)
      .single();

    if (!integration?.plaid_item_id || !integration?.plaid_account_id) {
      throw new AppError('Account is not connected to Plaid', 400);
    }

    const item = await this.plaidItemsRepository.findByItemId(integration.plaid_item_id);
    if (!item) {
      throw new AppError('Plaid item not found', 404);
    }

    // Verify ownership
    if (item.user_id !== userId) {
      throw new AppError('Unauthorized', 403);
    }

    // Get access token
    const accessToken = await this.plaidItemsRepository.getAccessToken(integration.plaid_item_id);
    if (!accessToken) {
      throw new AppError('Failed to get access token', 500);
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = item.last_successful_update
      ? new Date(item.last_successful_update)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    return await this.syncAccountInternal(
      integration.plaid_item_id,
      integration.plaid_account_id,
      accessToken,
      startDate,
      endDate,
      userId
    );
  }

  /**
   * Internal method to sync a single account using /transactions/sync
   * Uses cursor-based pagination as recommended by Plaid
   */
  private async syncAccountInternal(
    itemId: string,
    plaidAccountId: string,
    accessToken: string,
    startDate: Date,
    endDate: Date,
    userId: string
  ): Promise<{
    transactionsCreated: number;
    transactionsSkipped: number;
  }> {
    // Find our internal account ID from plaid_account_id
    const supabase = await createServerClient();
    const { data: integration } = await supabase
      .from('account_integrations')
      .select('account_id')
      .eq('plaid_item_id', itemId)
      .eq('plaid_account_id', plaidAccountId)
      .single();

    if (!integration) {
      throw new AppError('Account integration not found', 404);
    }

    const accountId = integration.account_id;
    const householdId = await getActiveHouseholdId(userId);

    // Get current cursor from item (stored in plaid_items table)
    const item = await this.plaidItemsRepository.findByItemId(itemId);
    if (!item) {
      throw new AppError('Plaid item not found', 404);
    }
    const itemDomain = PlaidMapper.toDomain(item);
    let cursor: string | null = itemDomain.transactionsCursor || null;

    let transactionsCreated = 0;
    let transactionsSkipped = 0;
    let savedCursor: string | null = cursor; // Keep track of cursor before pagination
    let hasMore = true;

    // Process transactions in batches using cursor (following Plaid's recommended pattern)
    // Pattern from: https://plaid.com/docs/transactions/add-to-app/
    while (hasMore) {
      try {
        const syncResult = await syncTransactions(
          accessToken,
          cursor,
          [plaidAccountId]
        );

        // Process added transactions
        for (const plaidTx of syncResult.added) {
          try {
            // Check if transaction already exists (deduplication)
            const existing = await supabase
              .from('transactions')
              .select('id')
              .eq('plaid_transaction_id', plaidTx.transactionId)
              .single();

            if (existing.data) {
              transactionsSkipped++;
              continue;
            }

            // Map Plaid transaction to domain
            const txData = PlaidMapper.plaidTransactionToDomain(
              plaidTx,
              accountId,
              userId,
              householdId
            );

            // Create transaction
            const now = formatTimestamp(new Date());
            const txId = randomUUID();

            await this.transactionsRepository.create({
              id: txId,
              date: txData.date as string,
              type: txData.type as 'income' | 'expense' | 'transfer',
              amount: txData.amount as number,
              accountId: txData.accountId as string,
              categoryId: txData.categoryId ?? null,
              subcategoryId: txData.subcategoryId ?? null,
              description: encryptDescription(txData.description || null),
              descriptionSearch: normalizeDescription(txData.description || null),
              tags: null,
              isRecurring: false,
              expenseType: null,
              transferToId: null,
              transferFromId: null,
              userId,
              householdId,
              suggestedCategoryId: null,
              suggestedSubcategoryId: null,
              receiptUrl: null,
              plaidTransactionId: plaidTx.transactionId, // Set directly for deduplication
              createdAt: now,
              updatedAt: now,
            });

            transactionsCreated++;
          } catch (error: unknown) {
            // If it's a duplicate key error, skip
            const errorCode = (error as { code?: string })?.code;
            const errorMessage = error instanceof Error ? error.message : '';
            if (errorCode === '23505' || errorMessage.includes('duplicate')) {
              transactionsSkipped++;
              continue;
            }

            logger.error('[PlaidService] Error creating transaction', {
              plaidTransactionId: plaidTx.transactionId,
              error: errorMessage || 'Unknown error',
            });
            // Continue with next transaction
          }
        }

        // Process modified transactions (update existing)
        for (const plaidTx of syncResult.modified) {
          try {
            // Find existing transaction by plaid_transaction_id
            const existing = await supabase
              .from('transactions')
              .select('id')
              .eq('plaid_transaction_id', plaidTx.transactionId)
              .single();

            if (existing.data) {
              // Map Plaid transaction to domain
              const txData = PlaidMapper.plaidTransactionToDomain(
                plaidTx,
                accountId,
                userId,
                householdId
              );

              // Update transaction
              await this.transactionsRepository.update(existing.data.id, {
                date: txData.date as string,
                type: txData.type as 'income' | 'expense' | 'transfer',
                amount: txData.amount as number,
                description: encryptDescription(txData.description || null),
                descriptionSearch: normalizeDescription(txData.description || null),
                updatedAt: formatTimestamp(new Date()),
              });

              transactionsCreated++; // Count as processed
            } else {
              // Modified transaction not found - treat as new
              const txData = PlaidMapper.plaidTransactionToDomain(
                plaidTx,
                accountId,
                userId,
                householdId
              );

              const now = formatTimestamp(new Date());
              const txId = randomUUID();

              await this.transactionsRepository.create({
                id: txId,
                date: txData.date as string,
                type: txData.type as 'income' | 'expense' | 'transfer',
                amount: txData.amount as number,
                accountId: txData.accountId as string,
                categoryId: txData.categoryId ?? null,
                subcategoryId: txData.subcategoryId ?? null,
                description: encryptDescription(txData.description || null),
                descriptionSearch: normalizeDescription(txData.description || null),
                tags: null,
                isRecurring: false,
                expenseType: null,
                transferToId: null,
                transferFromId: null,
                userId,
                householdId,
                suggestedCategoryId: null,
                suggestedSubcategoryId: null,
                receiptUrl: null,
                plaidTransactionId: plaidTx.transactionId,
                createdAt: now,
                updatedAt: now,
              });

              transactionsCreated++;
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[PlaidService] Error updating transaction', {
              plaidTransactionId: plaidTx.transactionId,
              error: errorMessage,
            });
            // Continue with next transaction
          }
        }

        // Process removed transactions (delete from our database)
        for (const removedTransactionId of syncResult.removed) {
          try {
            const existing = await supabase
              .from('transactions')
              .select('id')
              .eq('plaid_transaction_id', removedTransactionId)
              .single();

            if (existing.data) {
              await this.transactionsRepository.delete(existing.data.id);
              transactionsSkipped++; // Count as processed
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[PlaidService] Error removing transaction', {
              plaidTransactionId: removedTransactionId,
              error: errorMessage,
            });
            // Continue with next transaction
          }
        }

        // Update cursor and hasMore for next iteration
        // Following Plaid's recommended pattern: https://plaid.com/docs/transactions/add-to-app/
        savedCursor = syncResult.nextCursor;
        cursor = syncResult.nextCursor;
        hasMore = syncResult.hasMore;

        // Save cursor to database after each successful page
        // This allows recovery if sync is interrupted
        if (syncResult.nextCursor) {
          await this.plaidItemsRepository.update(itemId, {
            transactionsCursor: syncResult.nextCursor,
          });
        }
      } catch (error: unknown) {
        // Handle TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION error
        // Restart with the saved cursor as per Plaid documentation
        // See: https://plaid.com/docs/transactions/add-to-app/
        const errorResponse = (error as { response?: { data?: { error_code?: string } } })?.response?.data;
        if (errorResponse?.error_code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') {
          logger.warn('[PlaidService] Mutation during pagination, restarting with saved cursor', {
            itemId,
            savedCursor,
          });
          cursor = savedCursor; // Restart with saved cursor
          hasMore = true; // Continue pagination
          continue; // Retry with saved cursor
        }

        // Re-throw other errors
        throw error;
      }
    }

    // Persist final cursor when sync is complete (has_more is false)
    // Following Plaid's pattern: persist cursor after applying all updates
    await this.plaidItemsRepository.update(itemId, {
      transactionsCursor: cursor, // Save final cursor (may be null if sync complete)
    });

    return {
      transactionsCreated,
      transactionsSkipped,
    };
  }

  /**
   * Map Plaid account type to our account type
   */
  private mapPlaidAccountTypeToOurType(
    plaidType: PlaidAccount['type'],
    plaidSubtype: string | null
  ): 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other' {
    if (plaidType === 'investment') {
      return 'investment';
    }

    if (plaidType === 'credit') {
      return 'credit';
    }

    if (plaidType === 'depository') {
      const subtype = plaidSubtype?.toLowerCase() || '';
      if (subtype === 'checking') {
        return 'checking';
      }
      if (subtype === 'savings') {
        return 'savings';
      }
      // Default depository to checking
      return 'checking';
    }

    // Default to other
    return 'other';
  }

  /**
   * Map Plaid error code to item status
   */
  private mapErrorToStatus(errorCode: string): string {
    const code = errorCode.toUpperCase();

    // Map common error codes to status
    if (code === 'ITEM_LOGIN_REQUIRED') {
      return 'item_login_required';
    }
    if (code.includes('RATE_LIMIT')) {
      return 'error';
    }
    if (code.includes('INSTITUTION_DOWN') || code.includes('INSTITUTION_NOT_RESPONDING')) {
      return 'error';
    }

    // Default to error status
    return 'error';
  }
}
