"use server";

import { plaidClient } from './index';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { formatTimestamp } from '@/lib/utils/timestamp';
import { createTransaction } from '@/lib/api/transactions';
import { suggestCategory } from '@/src/application/shared/category-learning';
import type { TransactionFormData } from '@/lib/validations/transaction';
import type { PlaidTransactionMetadata } from './types';
import { convertPlaidTransactionToCamelCase } from './utils';

const DEFAULT_BATCH_SIZE = 50;
const BATCH_DELAY_MS = 100;

/**
 * Sync transactions from Plaid for a specific account in batches
 * Updates ImportJob progress after each batch
 * 
 * @param accountId - The account ID in our database
 * @param plaidAccountId - The Plaid account ID
 * @param accessToken - The Plaid access token
 * @param jobId - The ImportJob ID for progress tracking
 * @param batchSize - Number of transactions to process per batch (default: 50)
 * @returns Object with counts of synced, skipped, errors, and totalProcessed
 */
export async function syncAccountTransactionsBatched(
  accountId: string,
  plaidAccountId: string,
  accessToken: string,
  jobId: string,
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<{
  synced: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
}> {
  const supabase = await createServerClient();
  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let totalProcessed = 0;

  try {
    // Get the itemId and cursor for this connection
    const { data: account } = await supabase
      .from('Account')
      .select('plaidItemId, type, householdId, userId')
      .eq('id', accountId)
      .single();

    // Get userId from account or job (required for transaction creation)
    let userId = account?.userId;
    if (!userId) {
      const { data: job } = await supabase
        .from('ImportJob')
        .select('userId')
        .eq('id', jobId)
        .single();
      userId = job?.userId || null;
    }
    
    if (!userId) {
      throw new Error(`Cannot determine userId for account ${accountId}. Account and job both missing userId.`);
    }

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

    // Fetch all transactions from Plaid (same logic as sync.ts)
    let addedTransactions: any[] = [];
    let modifiedTransactions: any[] = [];
    let removedTransactionIds: string[] = [];
    let hasMore = true;
    let currentCursor = cursor;
    let originalCursor: string | null = null;

    while (hasMore) {
      try {
        const syncResponse = await plaidClient.transactionsSync({
          access_token: accessToken,
          cursor: currentCursor || undefined,
        });

        const { added, modified, removed, has_more, next_cursor } = syncResponse.data;
        
        addedTransactions.push(...(added || []));
        modifiedTransactions.push(...(modified || []));
        removedTransactionIds.push(...(removed?.map((tx: any) => tx.transaction_id) || []));
        
        if (has_more && !originalCursor) {
          originalCursor = currentCursor || null;
        }
        
        currentCursor = next_cursor || null;
        hasMore = has_more || false;

        if (currentCursor && itemId) {
          await supabase
            .from('PlaidConnection')
            .update({ 
              transactionsCursor: currentCursor,
              updatedAt: formatTimestamp(new Date()),
            })
            .eq('itemId', itemId);
        }

        if (!hasMore) {
          originalCursor = null;
          break;
        }
      } catch (error: any) {
        if (error.response?.data?.error_code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') {
          console.warn('[PLAID SYNC BATCHED] Mutation during pagination, restarting from original cursor');
          addedTransactions = [];
          modifiedTransactions = [];
          removedTransactionIds = [];
          currentCursor = originalCursor || cursor;
          hasMore = true;
          continue;
        }
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

    const totalTransactions = accountAdded.length + accountModified.length;

    // Update job with total items
    await supabase
      .from('ImportJob')
      .update({
        totalItems: totalTransactions,
        updatedAt: formatTimestamp(new Date()),
      })
      .eq('id', jobId);

    // Get already synced transaction IDs
    const { data: syncedTransactions } = await supabase
      .from('TransactionSync')
      .select('plaidTransactionId, transactionId')
      .eq('accountId', accountId);

    const syncedMap = new Map(
      syncedTransactions?.map((t) => [t.plaidTransactionId, t.transactionId]) || []
    );

    // Process added transactions in batches
    for (let i = 0; i < accountAdded.length; i += batchSize) {
      const batch = accountAdded.slice(i, i + batchSize);
      
      for (const plaidTx of batch) {
        // Skip if already synced (first check - in-memory map)
        if (syncedMap.has(plaidTx.transaction_id)) {
          skipped++;
          totalProcessed++;
          continue;
        }

        // CRITICAL: Double-check in database to prevent race conditions
        const { data: existingSync } = await supabase
          .from('TransactionSync')
          .select('plaidTransactionId, transactionId')
          .eq('plaidTransactionId', plaidTx.transaction_id)
          .eq('accountId', accountId)
          .single();

        if (existingSync) {
          // Transaction already exists - update map and skip
          syncedMap.set(plaidTx.transaction_id, existingSync.transactionId);
          skipped++;
          totalProcessed++;
          console.log('[PLAID SYNC BATCHED] Skipping duplicate transaction (found in DB):', plaidTx.transaction_id);
          continue;
        }

        try {
          const result = await processTransaction(
            supabase,
            accountId,
            plaidTx,
            account?.type || 'checking',
            account?.householdId || null,
            userId || null
          );

          if (result.success) {
            synced++;
            syncedMap.set(plaidTx.transaction_id, result.transactionId);
          } else {
            errors++;
          }
          totalProcessed++;
        } catch (error) {
          console.error('Error syncing transaction:', plaidTx.transaction_id, error);
          errors++;
          totalProcessed++;
        }
      }

      // Update job progress after each batch
      const progress = totalTransactions > 0 
        ? Math.round((totalProcessed / totalTransactions) * 100)
        : 100;

      await supabase
        .from('ImportJob')
        .update({
          progress,
          processedItems: totalProcessed,
          syncedItems: synced,
          skippedItems: skipped,
          errorItems: errors,
          updatedAt: formatTimestamp(new Date()),
        })
        .eq('id', jobId);

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < accountAdded.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Process modified transactions - update existing transactions with new data
    for (const plaidTx of accountModified) {
      const existingTransactionId = syncedMap.get(plaidTx.transaction_id);
      
      if (!existingTransactionId) {
        // Transaction was modified but we don't have it - treat as new
        try {
          const result = await processTransaction(
            supabase,
            accountId,
            plaidTx,
            account?.type || 'checking',
            account?.householdId || null,
            userId || null
          );

          if (result.success) {
            synced++;
            syncedMap.set(plaidTx.transaction_id, result.transactionId);
          } else {
            errors++;
          }
          totalProcessed++;
        } catch (error) {
          console.error('Error processing modified transaction (as new):', plaidTx.transaction_id, error);
          errors++;
          totalProcessed++;
        }
      } else {
        // Update existing transaction with new data (amount, date, description, metadata, etc.)
        try {
          const result = await updateModifiedTransaction(
            supabase,
            existingTransactionId,
            plaidTx,
            account?.type || 'checking',
            accountId
          );

          if (result.success) {
            // Count as synced since we updated it
            synced++;
            console.log('[PLAID SYNC BATCHED] Updated modified transaction:', {
              transactionId: existingTransactionId,
              plaidTransactionId: plaidTx.transaction_id,
              newAmount: Math.abs(plaidTx.amount),
            });
          } else {
            errors++;
          }
          totalProcessed++;
        } catch (error) {
          console.error('Error updating modified transaction:', plaidTx.transaction_id, error);
          errors++;
          totalProcessed++;
        }
      }

      // Update progress periodically for modified transactions too
      if (totalProcessed % batchSize === 0) {
        const progress = totalTransactions > 0 
          ? Math.round((totalProcessed / totalTransactions) * 100)
          : 100;

        await supabase
          .from('ImportJob')
          .update({
            progress,
            processedItems: totalProcessed,
            syncedItems: synced,
            skippedItems: skipped,
            errorItems: errors,
            updatedAt: formatTimestamp(new Date()),
          })
          .eq('id', jobId);
      }
    }

    // Update account's lastSyncedAt
    await supabase
      .from('Account')
      .update({ lastSyncedAt: formatTimestamp(new Date()) })
      .eq('id', accountId);

    return { synced, skipped, errors, totalProcessed };
  } catch (error: any) {
    console.error('Error syncing account transactions (batched):', error);
    throw new Error(error.message || 'Failed to sync transactions');
  }
}

/**
 * Helper function to process a single transaction
 * Extracted from sync.ts logic for reusability
 */
async function processTransaction(
  supabase: any,
  accountId: string,
  plaidTx: any,
  accountType: string,
  householdId: string | null,
  userId: string | null
): Promise<{ success: boolean; transactionId?: string }> {
  // Determine transaction type (expense/income)
  const isExpense = determineTransactionType(plaidTx, accountType);

  // Parse date
  const plaidDate = new Date(plaidTx.date + 'T00:00:00');
  if (isNaN(plaidDate.getTime())) {
    throw new Error(`Invalid date format from Plaid: ${plaidTx.date}`);
  }

  const description = plaidTx.name || plaidTx.merchant_name || plaidTx.original_description || 'Plaid Transaction';
  const amount = Math.abs(plaidTx.amount);
  
  // Detect credit card payments - these should be transfers, not income
  let type: 'expense' | 'income' | 'transfer' = isExpense ? 'expense' : 'income';
  if (accountType === 'credit' && !isExpense) {
    const transactionCode = plaidTx.transaction_code;
    const categories = Array.isArray(plaidTx.category) ? plaidTx.category : [];
    const categoryPrimary = categories.length > 0 ? categories[0].toLowerCase() : '';
    
    // Check if this is a credit card payment
    const isCreditCardPayment = (
      transactionCode === 'payment' || 
      transactionCode === 'credit' ||
      (plaidTx.amount < 0 && (
        categoryPrimary.includes('payment') ||
        categoryPrimary.includes('transfer') ||
        description.toLowerCase().includes('payment') ||
        description.toLowerCase().includes('credit card payment')
      ))
    );

    if (isCreditCardPayment) {
      // Credit card payments should be transfers, not income
      type = 'transfer';
    }
  }

  // Convert Plaid transaction to camelCase
  const convertedTx = convertPlaidTransactionToCamelCase(plaidTx);
  
  // Build Plaid metadata
  const plaidMetadata: PlaidTransactionMetadata = {
    category: convertedTx.category || plaidTx.category || null,
    categoryId: convertedTx.categoryId || plaidTx.category_id || null,
    transactionType: convertedTx.transactionType || plaidTx.transaction_type || null,
    transactionCode: convertedTx.transactionCode || plaidTx.transaction_code || null,
    pending: convertedTx.pending !== undefined ? convertedTx.pending : (plaidTx.pending || false),
    authorizedDate: convertedTx.authorizedDate || plaidTx.authorized_date || null,
    authorizedDatetime: convertedTx.authorizedDatetime || plaidTx.authorized_datetime || null,
    datetime: convertedTx.datetime || plaidTx.datetime || null,
    isoCurrencyCode: convertedTx.isoCurrencyCode || plaidTx.iso_currency_code || null,
    unofficialCurrencyCode: convertedTx.unofficialCurrencyCode || plaidTx.unofficial_currency_code || null,
    merchantName: convertedTx.merchantName || plaidTx.merchant_name || null,
    merchantEntityId: convertedTx.merchantEntityId || plaidTx.merchant_entity_id || null,
    logoUrl: convertedTx.logoUrl || plaidTx.logo_url || null,
    website: convertedTx.website || plaidTx.website || null,
    personalFinanceCategory: convertedTx.personalFinanceCategory || plaidTx.personal_finance_category || null,
    personalFinanceCategoryIconUrl: convertedTx.personalFinanceCategoryIconUrl || plaidTx.personal_finance_category_icon_url || null,
    location: convertedTx.location || plaidTx.location || null,
    counterparties: convertedTx.counterparties || plaidTx.counterparties || null,
    paymentChannel: convertedTx.paymentChannel || plaidTx.payment_channel || null,
    paymentMeta: convertedTx.paymentMeta || plaidTx.payment_meta || null,
    accountOwner: convertedTx.accountOwner || plaidTx.account_owner || null,
    pendingTransactionId: convertedTx.pendingTransactionId || plaidTx.pending_transaction_id || null,
    checkNumber: convertedTx.checkNumber || plaidTx.check_number || null,
  };

  // Get category suggestion
  let categorySuggestion = null;
  if (userId) {
    try {
      categorySuggestion = await suggestCategory(userId, description, amount, type);
    } catch (error) {
      console.error('Error getting category suggestion:', error);
    }
  }

  const transactionData: TransactionFormData = {
    date: plaidDate,
    type,
    amount,
    accountId,
    description,
    categoryId: undefined,
    subcategoryId: undefined,
    recurring: false,
    // For credit card payments (transfers), transferFromId will be null initially
    // User can add it later via the form
    transferFromId: undefined,
  };

  // Create transaction
  // Pass userId for server-side operations (bypasses auth check)
  const transaction = await createTransaction(transactionData, userId || undefined);
  const transactionId = (transaction as any).id || (transaction as any).outgoing?.id || null;
  
  if (!transactionId) {
    throw new Error('Failed to get transaction ID after creation');
  }

  // Update transaction with metadata
  const updateData: any = {
    plaidMetadata: plaidMetadata as any,
    updatedAt: formatTimestamp(new Date()),
  };

  if (categorySuggestion) {
    updateData.suggestedCategoryId = categorySuggestion.categoryId;
    updateData.suggestedSubcategoryId = categorySuggestion.subcategoryId || null;
  }

  const { error: updateError } = await supabase
    .from('Transaction')
    .update(updateData)
    .eq('id', transactionId);

  if (updateError) {
    throw updateError;
  }

  // Record sync - use upsert to handle race conditions
  const syncId = crypto.randomUUID();
  const { error: syncError } = await supabase
    .from('TransactionSync')
    .upsert({
      id: syncId,
      accountId,
      plaidTransactionId: plaidTx.transaction_id,
      transactionId: transactionId,
      householdId: householdId,
      syncDate: formatTimestamp(new Date()),
      status: 'synced',
    }, {
      onConflict: 'plaidTransactionId',
      ignoreDuplicates: false,
    });

  if (syncError) {
    // Check if it's a duplicate key error (race condition)
    if (syncError.code === '23505' || syncError.message?.includes('duplicate') || syncError.message?.includes('unique')) {
      console.warn('[PLAID SYNC BATCHED] TransactionSync already exists (race condition):', plaidTx.transaction_id);
      // Transaction was already synced by another process - this is OK, return success
      return { success: true, transactionId };
    } else {
      throw syncError;
    }
  }

  return { success: true, transactionId };
}

/**
 * Update an existing transaction with modified data from Plaid
 * Handles cases where pending transactions are confirmed with different amounts
 */
async function updateModifiedTransaction(
  supabase: any,
  existingTransactionId: string,
  plaidTx: any,
  accountType: string,
  accountId: string
): Promise<{ success: boolean }> {
  // Determine transaction type using the same logic as sync.ts
  const plaidTransactionType = (plaidTx as any).transaction_type || null;
  let isExpense: boolean;
  
  const transactionCode = plaidTx.transaction_code;
  const categories = Array.isArray(plaidTx.category) ? plaidTx.category : [];
  const categoryPrimary = categories.length > 0 ? categories[0].toLowerCase() : '';
  const categorySecondary = categories.length > 1 ? categories[1].toLowerCase() : '';
  
  // Plaid transaction_code values that indicate expenses (European institutions)
  const expenseTransactionCodes = [
    'purchase', 'bill payment', 'bank charge', 'cashback', 'direct debit', 'standing order'
  ];
  const incomeTransactionCodes = ['interest'];
  const ambiguousTransactionCodes = ['transfer', 'cash', 'atm', 'cheque', 'adjustment'];
  
  const transactionCodeLower = transactionCode ? transactionCode.toLowerCase() : '';
  const codeIndicatesExpense = expenseTransactionCodes.includes(transactionCodeLower);
  const codeIndicatesIncome = incomeTransactionCodes.includes(transactionCodeLower);
  const codeIsAmbiguous = ambiguousTransactionCodes.includes(transactionCodeLower);
  
  // Plaid categories that indicate income (deposits, transfers in, interest, etc.)
  const incomeCategories = [
    'transfer', 'deposit', 'interest', 'dividend', 'salary', 'payroll',
    'income', 'reimbursement', 'refund', 'payment', 'credit'
  ];
  
  // Plaid categories that indicate expenses (purchases, bills, fees, etc.)
  const expenseCategories = [
    'food and drink', 'shops', 'gas stations', 'groceries', 'restaurants',
    'general merchandise', 'entertainment', 'travel', 'bills', 'utilities',
    'bank fees', 'atm', 'fees', 'service', 'tax', 'healthcare', 'transportation'
  ];
  
  // Check if category indicates income or expense
  const categoryIndicatesIncome = incomeCategories.some(cat => 
    categoryPrimary.includes(cat) || categorySecondary.includes(cat)
  );
  const categoryIndicatesExpense = expenseCategories.some(cat => 
    categoryPrimary.includes(cat) || categorySecondary.includes(cat)
  );
  
  if (accountType === 'credit') {
    // Use transaction_type as primary indicator (most reliable for US/Canada)
    if (plaidTransactionType === 'place' || plaidTransactionType === 'digital') {
      isExpense = true;
    } else if (plaidTransactionType === 'special') {
      // Use transaction_code as primary indicator if available (European institutions)
      if (codeIndicatesExpense) {
        isExpense = true;
      } else if (codeIndicatesIncome) {
        isExpense = false;
      } else if (
        transactionCode === 'payment' || 
        transactionCode === 'credit' || 
        (transactionCode === 'transfer' && plaidTx.amount < 0) ||
        categoryIndicatesIncome
      ) {
        isExpense = false;
      } else if (categoryIndicatesExpense) {
        isExpense = true;
      } else {
        isExpense = plaidTx.amount > 0;
      }
    } else {
      // transaction_type is null or "unresolved" - use other indicators
      if (codeIndicatesExpense) {
        isExpense = true;
      } else if (codeIndicatesIncome) {
        isExpense = false;
      } else if (
        transactionCode === 'payment' || 
        transactionCode === 'credit' || 
        (transactionCode === 'transfer' && plaidTx.amount < 0) ||
        categoryIndicatesIncome
      ) {
        isExpense = false;
      } else if (categoryIndicatesExpense) {
        isExpense = true;
      } else {
        isExpense = plaidTx.amount > 0;
      }
    }
  } else {
    // For deposit accounts: use transaction_type first (most reliable for US/Canada)
    if (plaidTransactionType === 'place' || plaidTransactionType === 'digital') {
      // "place" = physical purchase, "digital" = online purchase - both are expenses
      isExpense = true;
    } else if (plaidTransactionType === 'special') {
      // "special" = ATM, transfer, etc. - need to check other indicators
      if (codeIndicatesExpense) {
        isExpense = true;
      } else if (codeIndicatesIncome) {
        isExpense = false;
      } else if (codeIsAmbiguous) {
        const hasMerchantName = !!(plaidTx.merchant_name || plaidTx.name);
        if (categoryIndicatesExpense || (hasMerchantName && !categoryIndicatesIncome)) {
          isExpense = true;
        } else if (categoryIndicatesIncome) {
          isExpense = false;
        } else {
          isExpense = plaidTx.amount < 0;
        }
      } else if (categoryIndicatesExpense) {
        isExpense = true;
      } else if (categoryIndicatesIncome) {
        isExpense = false;
      } else {
        isExpense = plaidTx.amount < 0;
      }
    } else {
      // transaction_type is null or "unresolved" - use other indicators
      if (codeIndicatesExpense) {
        isExpense = true;
      } else if (codeIndicatesIncome) {
        isExpense = false;
      } else if (codeIsAmbiguous) {
        const hasMerchantName = !!(plaidTx.merchant_name || plaidTx.name);
        if (categoryIndicatesExpense || (hasMerchantName && !categoryIndicatesIncome)) {
          isExpense = true;
        } else if (categoryIndicatesIncome) {
          isExpense = false;
        } else {
          isExpense = plaidTx.amount < 0;
        }
      } else if (categoryIndicatesExpense) {
        isExpense = true;
      } else if (categoryIndicatesIncome) {
        isExpense = false;
      } else {
        const hasMerchantName = !!(plaidTx.merchant_name || plaidTx.name);
        if (hasMerchantName && !categoryIndicatesIncome) {
          isExpense = true;
        } else {
          const description = (plaidTx.name || plaidTx.merchant_name || plaidTx.original_description || '').toLowerCase();
          const isLikelyExpense = description.includes('purchase') || 
                                 description.includes('payment') || 
                                 description.includes('debit') ||
                                 description.includes('withdrawal') ||
                                 description.includes('pos');
          const isLikelyIncome = description.includes('deposit') || 
                                description.includes('credit') || 
                                description.includes('transfer in') ||
                                description.includes('salary') ||
                                description.includes('payroll') ||
                                description.includes('refund');
          
          if (isLikelyExpense && !isLikelyIncome) {
            isExpense = true;
          } else if (isLikelyIncome && !isLikelyExpense) {
            isExpense = false;
          } else {
            isExpense = plaidTx.amount < 0;
          }
        }
      }
    }
  }

  // Detect credit card payments - these should be transfers, not income
  let type: 'expense' | 'income' | 'transfer' = isExpense ? 'expense' : 'income';
  if (accountType === 'credit' && !isExpense) {
    const isCreditCardPayment = (
      transactionCode === 'payment' || 
      transactionCode === 'credit' ||
      (plaidTx.amount < 0 && (
        categoryPrimary.includes('payment') ||
        categoryPrimary.includes('transfer') ||
        (plaidTx.name || plaidTx.merchant_name || '').toLowerCase().includes('payment') ||
        (plaidTx.name || plaidTx.merchant_name || '').toLowerCase().includes('credit card payment')
      ))
    );

    if (isCreditCardPayment) {
      type = 'transfer';
    }
  }

  const plaidDate = new Date(plaidTx.date + 'T00:00:00');
  if (isNaN(plaidDate.getTime())) {
    throw new Error(`Invalid date format from Plaid: ${plaidTx.date}`);
  }

  const description = plaidTx.name || plaidTx.merchant_name || plaidTx.original_description || 'Plaid Transaction';
  const amount = Math.abs(plaidTx.amount);

  // Convert Plaid transaction to camelCase format
  const convertedTx = convertPlaidTransactionToCamelCase(plaidTx);
  
  const plaidMetadata: PlaidTransactionMetadata = {
    // Categories
    category: convertedTx.category || plaidTx.category || null,
    categoryId: convertedTx.categoryId || plaidTx.category_id || null,
    
    // Transaction type and codes
    transactionType: convertedTx.transactionType || plaidTx.transaction_type || null,
    transactionCode: convertedTx.transactionCode || plaidTx.transaction_code || null,
    
    // Status and dates
    pending: convertedTx.pending !== undefined ? convertedTx.pending : (plaidTx.pending || false),
    authorizedDate: convertedTx.authorizedDate || plaidTx.authorized_date || null,
    authorizedDatetime: convertedTx.authorizedDatetime || plaidTx.authorized_datetime || null,
    datetime: convertedTx.datetime || plaidTx.datetime || null,
    
    // Currency
    isoCurrencyCode: convertedTx.isoCurrencyCode || plaidTx.iso_currency_code || null,
    unofficialCurrencyCode: convertedTx.unofficialCurrencyCode || plaidTx.unofficial_currency_code || null,
    
    // Merchant information
    merchantName: convertedTx.merchantName || plaidTx.merchant_name || null,
    merchantEntityId: convertedTx.merchantEntityId || plaidTx.merchant_entity_id || null,
    logoUrl: convertedTx.logoUrl || plaidTx.logo_url || null,
    website: convertedTx.website || plaidTx.website || null,
    
    // Personal finance category
    personalFinanceCategory: convertedTx.personalFinanceCategory || plaidTx.personal_finance_category || null,
    personalFinanceCategoryIconUrl: convertedTx.personalFinanceCategoryIconUrl || plaidTx.personal_finance_category_icon_url || null,
    
    // Location
    location: convertedTx.location || plaidTx.location || null,
    
    // Counterparties
    counterparties: convertedTx.counterparties || plaidTx.counterparties || null,
    
    // Payment information
    paymentChannel: convertedTx.paymentChannel || plaidTx.payment_channel || null,
    paymentMeta: convertedTx.paymentMeta || plaidTx.payment_meta || null,
    
    // Account and transaction relationships
    accountOwner: convertedTx.accountOwner || plaidTx.account_owner || null,
    pendingTransactionId: convertedTx.pendingTransactionId || plaidTx.pending_transaction_id || null,
    checkNumber: convertedTx.checkNumber || plaidTx.check_number || null,
  };

  // Update the transaction with new data
  const { error: updateError } = await supabase
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

  if (updateError) {
    console.error('Error updating existing transaction with metadata:', {
      transactionId: existingTransactionId,
      plaidTransactionId: plaidTx.transaction_id,
      error: updateError,
    });
    throw updateError;
  }

  // Update TransactionSync record
  const { error: syncUpdateError } = await supabase
    .from('TransactionSync')
    .update({
      syncDate: formatTimestamp(new Date()),
      status: 'synced',
    })
    .eq('transactionId', existingTransactionId)
    .eq('plaidTransactionId', plaidTx.transaction_id);

  if (syncUpdateError) {
    console.error('Error updating TransactionSync record:', syncUpdateError);
    // Don't throw - the main transaction was updated successfully
  }

  return { success: true };
}

/**
 * Determine if a transaction is an expense or income
 * Simplified version of the logic from sync.ts
 */
function determineTransactionType(plaidTx: any, accountType: string): boolean {
  const transactionCode = plaidTx.transaction_code;
  const plaidTransactionType = (plaidTx as any).transaction_type || null;
  const categories = Array.isArray(plaidTx.category) ? plaidTx.category : [];
  const categoryPrimary = categories.length > 0 ? categories[0].toLowerCase() : '';

  // For credit accounts: positive = expense, negative = income
  if (accountType === 'credit') {
    if (plaidTransactionType === 'place' || plaidTransactionType === 'digital') {
      return true;
    }
    return plaidTx.amount > 0;
  }

  // For deposit accounts: use transaction_type first
  if (plaidTransactionType === 'place' || plaidTransactionType === 'digital') {
    return true;
  }

  // Check category
  const incomeCategories = ['transfer', 'deposit', 'interest', 'dividend', 'salary', 'payroll', 'income', 'reimbursement', 'refund'];
  const expenseCategories = ['food and drink', 'shops', 'gas stations', 'groceries', 'restaurants', 'entertainment', 'travel', 'bills', 'utilities'];

  if (incomeCategories.some(cat => categoryPrimary.includes(cat))) {
    return false;
  }
  if (expenseCategories.some(cat => categoryPrimary.includes(cat))) {
    return true;
  }

  // Check merchant name
  if (plaidTx.merchant_name || plaidTx.name) {
    return true;
  }

  // Fall back to amount sign
  return plaidTx.amount < 0;
}

