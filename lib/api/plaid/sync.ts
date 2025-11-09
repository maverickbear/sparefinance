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
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch transactions from Plaid
    // Note: account_ids is not a valid parameter for transactionsGet
    // The API will return all transactions for the item, we'll filter by account later if needed
    const transactionsResponse = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });

    const plaidTransactions = transactionsResponse.data.transactions;

    // Filter transactions for the specific account
    const accountTransactions = plaidTransactions.filter(
      (tx) => tx.account_id === plaidAccountId
    );

    console.log(`Found ${accountTransactions.length} transactions for account ${plaidAccountId} out of ${plaidTransactions.length} total transactions`);

    // Get already synced transaction IDs
    const { data: syncedTransactions } = await supabase
      .from('TransactionSync')
      .select('plaidTransactionId')
      .eq('accountId', accountId);

    const syncedIds = new Set(
      syncedTransactions?.map((t) => t.plaidTransactionId) || []
    );

    // Process each transaction
    for (const plaidTx of accountTransactions) {
      // Skip if already synced
      if (syncedIds.has(plaidTx.transaction_id)) {
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

