"use server";

import { plaidClient } from './index';
import { createServerClient } from '@/lib/supabase-server';
import { formatTimestamp } from '@/lib/utils/timestamp';
import { createTransaction } from '@/lib/api/transactions';
import { suggestCategory } from '@/lib/api/category-learning';
import type { TransactionFormData } from '@/lib/validations/transaction';
import type { PlaidTransactionMetadata } from './types';

/**
 * Sync transactions from Plaid for a specific account
 * 
 * Uses the /transactions/sync API (recommended by Plaid)
 * @see https://plaid.com/docs/api/products/transactions/#transactionssync
 * 
 * This endpoint supports cursor-based pagination and handles:
 * - Added transactions
 * - Modified transactions  
 * - Removed transactions
 * 
 * @param accountId - The account ID in our database
 * @param plaidAccountId - The Plaid account ID
 * @param accessToken - The Plaid access token
 * @param daysBack - DEPRECATED: Not used with /transactions/sync (kept for compatibility)
 *                   Historical data is controlled by transactions.days_requested in link token
 * 
 * @returns Object with counts of synced, skipped, and errors
 */
export async function syncAccountTransactions(
  accountId: string,
  plaidAccountId: string,
  accessToken: string,
  daysBack: number = 30
): Promise<{
  synced: number;
  skipped: number;
  errors: number;
}> {
  const supabase = await createServerClient();
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Get the itemId and cursor for this connection
    // We need itemId to update the cursor, and we get it from the account
    const { data: account } = await supabase
      .from('Account')
      .select('plaidItemId')
      .eq('id', accountId)
      .single();

    const itemId = account?.plaidItemId;
    
    // Get cursor from PlaidConnection
    let cursor: string | null = null;
    if (itemId) {
      const { data: connection } = await supabase
        .from('PlaidConnection')
        .select('transactionsCursor')
        .eq('itemId', itemId)
        .single();
      
      cursor = connection?.transactionsCursor || null;
    }

    // Use /transactions/sync API (recommended by Plaid)
    // This API supports added, modified, and removed transactions
    // First call uses no cursor, subsequent calls use the returned cursor
    // Per Plaid docs: track both next_cursor and original cursor for pagination error recovery
    let addedTransactions: any[] = [];
    let modifiedTransactions: any[] = [];
    let removedTransactionIds: string[] = [];
    let hasMore = true;
    let currentCursor = cursor;
    let originalCursor: string | null = null; // Track first cursor when has_more becomes true

    while (hasMore) {
      try {
        const syncResponse = await plaidClient.transactionsSync({
          access_token: accessToken,
          cursor: currentCursor || undefined,
        });

        const { added, modified, removed, has_more, next_cursor } = syncResponse.data;
        
        // Collect all transaction changes
        addedTransactions.push(...(added || []));
        modifiedTransactions.push(...(modified || []));
        removedTransactionIds.push(...(removed?.map((tx: any) => tx.transaction_id) || []));
        
        // Track original cursor when pagination starts (has_more becomes true)
        if (has_more && !originalCursor) {
          originalCursor = currentCursor || null;
        }
        
        // Update cursor for next iteration
        currentCursor = next_cursor || null;
        hasMore = has_more || false;

        // Update cursor in database after each page
        if (currentCursor && itemId) {
          await supabase
            .from('PlaidConnection')
            .update({ 
              transactionsCursor: currentCursor,
              updatedAt: formatTimestamp(new Date()),
            })
            .eq('itemId', itemId);
        }

        // Break if no more pages
        if (!hasMore) {
          // Clear original cursor when pagination completes successfully
          originalCursor = null;
          break;
        }
      } catch (error: any) {
        // Handle TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION error
        // Per Plaid docs: restart from original cursor (first page of this update)
        if (error.response?.data?.error_code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') {
          console.warn('[PLAID SYNC] Mutation during pagination, restarting from original cursor');
          
          // Reset collections and restart from original cursor
          addedTransactions = [];
          modifiedTransactions = [];
          removedTransactionIds = [];
          currentCursor = originalCursor || cursor;
          hasMore = true;
          
          // Continue loop to retry from original cursor
          continue;
        }
        
        // Re-throw other errors
        throw error;
      }
    }

    // Filter transactions for the specific account
    const accountAdded = addedTransactions.filter(
      (tx) => tx.account_id === plaidAccountId
    );
    const accountModified = modifiedTransactions.filter(
      (tx) => tx.account_id === plaidAccountId
    );

    console.log(`[PLAID SYNC] Found ${accountAdded.length} added, ${accountModified.length} modified transactions for account ${plaidAccountId}`);

    // Get already synced transaction IDs with their transaction IDs
    const { data: syncedTransactions } = await supabase
      .from('TransactionSync')
      .select('plaidTransactionId, transactionId')
      .eq('accountId', accountId);

    const syncedMap = new Map(
      syncedTransactions?.map((t) => [t.plaidTransactionId, t.transactionId]) || []
    );

    // Process added transactions
    for (const plaidTx of accountAdded) {
      // Skip if already synced
      if (syncedMap.has(plaidTx.transaction_id)) {
        skipped++;
        continue;
      }

      try {
        // Map Plaid transaction to our transaction format
        // In Plaid, negative amounts are typically expenses (outflows) and positive amounts are income (inflows)
        // But we need to check the account type and transaction context
        const isExpense = plaidTx.amount < 0;
        
        // Parse Plaid date (format: YYYY-MM-DD)
        // Create date at midnight local time to avoid timezone issues
        const plaidDate = new Date(plaidTx.date + 'T00:00:00');
        
        if (isNaN(plaidDate.getTime())) {
          console.error('Invalid date from Plaid:', plaidTx.date);
          throw new Error(`Invalid date format from Plaid: ${plaidTx.date}`);
        }
        
        // Get userId from account for category learning
        const { data: accountData } = await supabase
          .from('Account')
          .select('userId')
          .eq('id', accountId)
          .single();

        const userId = accountData?.userId;
        const description = plaidTx.name || plaidTx.merchant_name || plaidTx.original_description || 'Plaid Transaction';
        const amount = Math.abs(plaidTx.amount);
        const type = isExpense ? 'expense' : 'income';

        // Build Plaid metadata object
        const plaidMetadata: PlaidTransactionMetadata = {
          category: plaidTx.category || null,
          category_id: plaidTx.category_id || null,
          pending: plaidTx.pending || false,
          authorized_date: plaidTx.authorized_date || null,
          authorized_datetime: plaidTx.authorized_datetime || null,
          datetime: plaidTx.datetime || null,
          iso_currency_code: plaidTx.iso_currency_code || null,
          unofficial_currency_code: plaidTx.unofficial_currency_code || null,
          transaction_code: plaidTx.transaction_code || null,
          account_owner: plaidTx.account_owner || null,
          pending_transaction_id: plaidTx.pending_transaction_id || null,
        };

        // Get category suggestion from learning model
        let categorySuggestion = null;
        if (userId) {
          try {
            categorySuggestion = await suggestCategory(userId, description, amount, type);
            console.log('Category suggestion:', {
              description: description.substring(0, 50),
              amount,
              type,
              suggestion: categorySuggestion ? {
                categoryId: categorySuggestion.categoryId,
                confidence: categorySuggestion.confidence,
                matchCount: categorySuggestion.matchCount,
              } : null,
            });
          } catch (error) {
            console.error('Error getting category suggestion:', error);
            // Continue without suggestion if there's an error
          }
        }

        const transactionData: TransactionFormData = {
          date: plaidDate,
          type,
          amount,
          accountId,
          description,
          // Don't auto-categorize - always show suggestions for user approval/rejection
          categoryId: undefined,
          subcategoryId: undefined,
          recurring: false,
        };

        console.log('Creating transaction from Plaid:', {
          date: plaidTx.date,
          parsedDate: plaidDate.toISOString(),
          type: transactionData.type,
          amount: transactionData.amount,
          accountId,
          description: transactionData.description?.substring(0, 50),
          autoCategorized: categorySuggestion?.confidence === 'high',
        });

        // Create transaction
        const transaction = await createTransaction(transactionData);
        
        // Handle case where createTransaction returns { outgoing, incoming } for transfers
        // or a single transaction object
        const transactionId = (transaction as any).id || (transaction as any).outgoing?.id || null;
        
        if (!transactionId) {
          console.error('Transaction created but no ID found:', transaction);
          throw new Error('Failed to get transaction ID after creation');
        }

        // Update transaction with Plaid metadata and category suggestions
        const updateData: any = {
          plaidMetadata: plaidMetadata as any,
          updatedAt: formatTimestamp(new Date()),
        };

        // If we have a suggestion (any confidence level), save it for user approval/rejection
        if (categorySuggestion) {
          updateData.suggestedCategoryId = categorySuggestion.categoryId;
          updateData.suggestedSubcategoryId = categorySuggestion.subcategoryId || null;
        }

        const { error: updateError } = await supabase
          .from('Transaction')
          .update(updateData)
          .eq('id', transactionId);

        if (updateError) {
          console.error('Error updating transaction with metadata:', updateError);
        } else {
          console.log('Transaction updated with Plaid metadata:', {
            transactionId,
            hasMetadata: !!plaidMetadata,
            pending: plaidMetadata.pending,
            hasCategory: !!plaidMetadata.category,
            suggestedCategoryId: categorySuggestion?.categoryId,
          });
        }

        // Record sync
        const syncId = crypto.randomUUID();
        const now = formatTimestamp(new Date());

        const { error: syncError } = await supabase
          .from('TransactionSync')
          .insert({
            id: syncId,
            accountId,
            plaidTransactionId: plaidTx.transaction_id,
            transactionId: transactionId,
            syncDate: now,
            status: 'synced',
          });

        if (syncError) {
          console.error('Error recording transaction sync:', syncError);
          errors++;
        } else {
          synced++;
        }
      } catch (error) {
        console.error('Error syncing transaction:', plaidTx.transaction_id, error);
        errors++;

        // Record failed sync
        const syncId = crypto.randomUUID();
        const now = formatTimestamp(new Date());

        await supabase
          .from('TransactionSync')
          .insert({
            id: syncId,
            accountId,
            plaidTransactionId: plaidTx.transaction_id,
            transactionId: null,
            syncDate: now,
            status: 'error',
          });
      }
    }

    // Process modified transactions
    for (const plaidTx of accountModified) {
      const existingTransactionId = syncedMap.get(plaidTx.transaction_id);
      
      if (!existingTransactionId) {
        // Transaction was modified but we don't have it - treat as new
        try {
          // Reuse the same processing logic as added transactions
          const isExpense = plaidTx.amount < 0;
          const plaidDate = new Date(plaidTx.date + 'T00:00:00');
          const description = plaidTx.name || plaidTx.merchant_name || plaidTx.original_description || 'Plaid Transaction';
          const amount = Math.abs(plaidTx.amount);
          const type = isExpense ? 'expense' : 'income';

          const transactionData: TransactionFormData = {
            date: plaidDate,
            type,
            amount,
            accountId,
            description,
            categoryId: undefined,
            subcategoryId: undefined,
            recurring: false,
          };

          const transaction = await createTransaction(transactionData);
          const transactionId = (transaction as any).id || (transaction as any).outgoing?.id || null;
          
          if (transactionId) {
            const plaidMetadata: PlaidTransactionMetadata = {
              category: plaidTx.category || null,
              category_id: plaidTx.category_id || null,
              pending: plaidTx.pending || false,
              authorized_date: plaidTx.authorized_date || null,
              authorized_datetime: plaidTx.authorized_datetime || null,
              datetime: plaidTx.datetime || null,
              iso_currency_code: plaidTx.iso_currency_code || null,
              unofficial_currency_code: plaidTx.unofficial_currency_code || null,
              transaction_code: plaidTx.transaction_code || null,
              account_owner: plaidTx.account_owner || null,
              pending_transaction_id: plaidTx.pending_transaction_id || null,
            };

            await supabase
              .from('Transaction')
              .update({ plaidMetadata: plaidMetadata as any })
              .eq('id', transactionId);

            await supabase
              .from('TransactionSync')
              .insert({
                id: crypto.randomUUID(),
                accountId,
                plaidTransactionId: plaidTx.transaction_id,
                transactionId: transactionId,
                syncDate: formatTimestamp(new Date()),
                status: 'synced',
              });

            synced++;
          }
        } catch (error) {
          console.error('Error processing modified transaction (as new):', plaidTx.transaction_id, error);
          errors++;
        }
      } else {
        // Update existing transaction
        try {
          const isExpense = plaidTx.amount < 0;
          const plaidDate = new Date(plaidTx.date + 'T00:00:00');
          const description = plaidTx.name || plaidTx.merchant_name || plaidTx.original_description || 'Plaid Transaction';
          const amount = Math.abs(plaidTx.amount);
          const type = isExpense ? 'expense' : 'income';

          const plaidMetadata: PlaidTransactionMetadata = {
            category: plaidTx.category || null,
            category_id: plaidTx.category_id || null,
            pending: plaidTx.pending || false,
            authorized_date: plaidTx.authorized_date || null,
            authorized_datetime: plaidTx.authorized_datetime || null,
            datetime: plaidTx.datetime || null,
            iso_currency_code: plaidTx.iso_currency_code || null,
            unofficial_currency_code: plaidTx.unofficial_currency_code || null,
            transaction_code: plaidTx.transaction_code || null,
            account_owner: plaidTx.account_owner || null,
            pending_transaction_id: plaidTx.pending_transaction_id || null,
          };

          await supabase
            .from('Transaction')
            .update({
              date: formatTimestamp(plaidDate),
              type,
              amount,
              description,
              plaidMetadata: plaidMetadata as any,
              updatedAt: formatTimestamp(new Date()),
            })
            .eq('id', existingTransactionId);
        } catch (error) {
          console.error('Error updating modified transaction:', plaidTx.transaction_id, error);
          errors++;
        }
      }
    }

    // Process removed transactions
    // Get all removed transaction IDs that belong to this account
    if (removedTransactionIds.length > 0) {
      const { data: removedSyncs } = await supabase
        .from('TransactionSync')
        .select('plaidTransactionId, transactionId')
        .eq('accountId', accountId)
        .in('plaidTransactionId', removedTransactionIds);

      for (const removedSync of removedSyncs || []) {
        if (removedSync.transactionId) {
          try {
            // Delete the transaction
            await supabase
              .from('Transaction')
              .delete()
              .eq('id', removedSync.transactionId);

            // Remove from TransactionSync
            await supabase
              .from('TransactionSync')
              .delete()
              .eq('plaidTransactionId', removedSync.plaidTransactionId);
          } catch (error) {
            console.error('Error removing transaction:', removedSync.plaidTransactionId, error);
            errors++;
          }
        }
      }
    }

    // Update account's lastSyncedAt
    const now = formatTimestamp(new Date());
    await supabase
      .from('Account')
      .update({ lastSyncedAt: now })
      .eq('id', accountId);

    return { synced, skipped, errors };
  } catch (error: any) {
    console.error('Error syncing account transactions:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      response: error.response?.data,
    });
    throw new Error(error.message || 'Failed to sync transactions');
  }
}

/**
 * Sync all connected accounts for a user
 */
export async function syncAllUserAccounts(userId: string): Promise<{
  accounts: number;
  totalSynced: number;
  totalSkipped: number;
  totalErrors: number;
}> {
  const supabase = await createServerClient();

  // Get all connected accounts for user
  const { data: accounts, error } = await supabase
    .from('Account')
    .select('id, plaidAccountId, plaidItemId, syncEnabled')
    .eq('userId', userId)
    .eq('isConnected', true)
    .eq('syncEnabled', true);

  if (error || !accounts) {
    throw new Error('Failed to fetch connected accounts');
  }

  let totalSynced = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Sync each account
  for (const account of accounts) {
    if (!account.plaidAccountId || !account.plaidItemId) {
      continue;
    }

    // Get access token
    const { data: connection } = await supabase
      .from('PlaidConnection')
      .select('accessToken')
      .eq('itemId', account.plaidItemId)
      .single();

    if (!connection?.accessToken) {
      continue;
    }

    try {
      const result = await syncAccountTransactions(
        account.id,
        account.plaidAccountId,
        connection.accessToken
      );

      totalSynced += result.synced;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    } catch (error) {
      console.error(`Error syncing account ${account.id}:`, error);
      totalErrors++;
    }
  }

  return {
    accounts: accounts.length,
    totalSynced,
    totalSkipped,
    totalErrors,
  };
}

