"use server";

import { plaidClient } from './index';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { formatTimestamp } from '@/src/infrastructure/utils/timestamp';
import { createTransaction } from '@/lib/api/transactions';
import { suggestCategory } from '@/src/application/shared/category-learning';
import type { TransactionFormData } from '@/src/domain/transactions/transactions.validations';
import type { PlaidTransactionMetadata } from './types';
import { convertPlaidTransactionToCamelCase } from './utils';

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
    // Also get account type to determine transaction type correctly
    // Get householdId for TransactionSync records
    // Get userId to pass to createTransaction for server-side operations
    const { data: account } = await supabase
      .from('Account')
      .select('plaidItemId, type, householdId, userId')
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
      // Skip if already synced (first check - in-memory map)
      if (syncedMap.has(plaidTx.transaction_id)) {
        skipped++;
        continue;
      }

      // CRITICAL: Double-check in database to prevent race conditions
      // This prevents duplicates when multiple syncs happen simultaneously
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
        console.log('[PLAID SYNC] Skipping duplicate transaction (found in DB):', plaidTx.transaction_id);
        continue;
      }

      try {
        // Map Plaid transaction to our transaction format
        // For deposit accounts (checking/savings): negative = expense, positive = income
        // For credit accounts: positive = expense (purchase increases debt), negative = income/payment (reduces debt)
        // We also check transaction_code and category to be more accurate
        let isExpense: boolean;
        
        const transactionCode = plaidTx.transaction_code;
        const plaidTransactionType = (plaidTx as any).transaction_type || null;
        const categories = Array.isArray(plaidTx.category) ? plaidTx.category : [];
        const categoryPrimary = categories.length > 0 ? categories[0].toLowerCase() : '';
        const categorySecondary = categories.length > 1 ? categories[1].toLowerCase() : '';
        
        // Plaid transaction_code values that indicate expenses
        // According to Plaid docs: transaction_code is only populated for European institutions
        const expenseTransactionCodes = [
          'purchase',           // Purchase made with a debit or credit card
          'bill payment',       // Payment of a bill
          'bank charge',        // Charge or fee levied by the institution
          'cashback',           // Cash withdrawal while making a debit card purchase
          'direct debit',       // Automatic withdrawal of funds initiated by a third party
          'standing order',     // Payment instructed by the account holder to a third party
        ];
        
        // Plaid transaction_code values that indicate income
        const incomeTransactionCodes = [
          'interest',           // Interest earned (usually income, but can be expense for loans)
        ];
        
        // Plaid transaction_code values that are ambiguous (need context)
        const ambiguousTransactionCodes = [
          'transfer',           // Transfer of money between accounts (can be expense or income)
          'cash',              // Cash deposit or withdrawal (can be expense or income)
          'atm',               // Cash deposit or withdrawal via ATM (can be expense or income)
          'cheque',            // Cheque payment (can be expense or income)
          'adjustment',        // Bank adjustment (can be expense or income)
        ];
        
        // Check if transaction_code indicates expense or income
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
        
        if (account?.type === 'credit') {
          // For credit cards: positive amounts are purchases (expenses), negative are payments (income/transfers)
          // But we also check transaction_type, transaction_code and category to be more accurate
          
          // Use transaction_type as primary indicator (most reliable for US/Canada)
          if (plaidTransactionType === 'place' || plaidTransactionType === 'digital') {
            // "place" = physical purchase, "digital" = online purchase - both are expenses
            isExpense = true;
          } else if (plaidTransactionType === 'special') {
            // "special" = ATM, transfer, etc. - need to check other indicators
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
              isExpense = false; // Payment/credit is income (reduces debt)
            } else if (categoryIndicatesExpense) {
              isExpense = true;
            } else {
              // For credit cards, positive amounts are usually purchases (expenses)
              isExpense = plaidTx.amount > 0;
            }
          } else {
            // transaction_type is null or "unresolved" - use other indicators
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
              isExpense = false; // Payment/credit is income (reduces debt)
            } else if (categoryIndicatesExpense) {
              isExpense = true; // Category clearly indicates expense
            } else {
              // For credit cards, positive amounts are usually purchases (expenses)
              // Negative amounts are usually payments/credits (income)
              isExpense = plaidTx.amount > 0;
            }
          }
        } else {
          // For deposit accounts: use transaction_type first (most reliable for US/Canada),
          // then transaction_code (European institutions), category, merchant_name, description, and finally amount sign
          // Some banks (especially Canadian) may return positive for expenses
          
          // Use transaction_type as primary indicator (most reliable for US/Canada)
          if (plaidTransactionType === 'place' || plaidTransactionType === 'digital') {
            // "place" = physical purchase, "digital" = online purchase - both are expenses
            // This is the most reliable indicator for US/Canadian banks
            isExpense = true;
          } else if (plaidTransactionType === 'special') {
            // "special" = ATM, transfer, etc. - need to check other indicators
            // Use transaction_code as primary indicator if available (European institutions)
            if (codeIndicatesExpense) {
              isExpense = true;
            } else if (codeIndicatesIncome) {
              isExpense = false;
            } else if (codeIsAmbiguous) {
              // For ambiguous codes like 'transfer', 'cash', 'atm', use amount sign and context
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
              // If transaction has merchant_name, it's almost certainly an expense
              const hasMerchantName = !!(plaidTx.merchant_name || plaidTx.name);
              if (hasMerchantName && !categoryIndicatesIncome) {
                isExpense = true;
              } else {
                isExpense = plaidTx.amount < 0;
              }
            }
          } else {
            // transaction_type is null or "unresolved" - use other indicators
            // Use transaction_code as primary indicator if available (European institutions)
            if (codeIndicatesExpense) {
              isExpense = true;
            } else if (codeIndicatesIncome) {
              isExpense = false;
            } else if (codeIsAmbiguous) {
              // For ambiguous codes, use amount sign and context
              const hasMerchantName = !!(plaidTx.merchant_name || plaidTx.name);
              if (categoryIndicatesExpense || (hasMerchantName && !categoryIndicatesIncome)) {
                isExpense = true;
              } else if (categoryIndicatesIncome) {
                isExpense = false;
              } else {
                isExpense = plaidTx.amount < 0;
              }
            } else if (categoryIndicatesExpense) {
              isExpense = true; // Category clearly indicates expense
            } else if (categoryIndicatesIncome) {
              isExpense = false; // Category clearly indicates income
            } else {
              // If transaction has merchant_name, it's almost certainly an expense (purchase at a store/restaurant)
              const hasMerchantName = !!(plaidTx.merchant_name || plaidTx.name);
              
              if (hasMerchantName && !categoryIndicatesIncome) {
                // If there's a merchant name (store, restaurant, etc.), it's almost certainly an expense
                // This handles cases where Canadian banks return positive amounts for expenses
                isExpense = true;
              } else {
                // Check description for common expense/income patterns
                const description = (plaidTx.name || plaidTx.merchant_name || plaidTx.original_description || '').toLowerCase();
                const isLikelyExpense = description.includes('purchase') || 
                                       description.includes('payment') || 
                                       description.includes('debit') ||
                                       description.includes('withdrawal') ||
                                       description.includes('pos') ||
                                       description.includes('purchase');
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
                  // Fall back to amount sign: negative = expense, positive = income
                  // This is the standard Plaid behavior for most US banks
                  // Note: Some Canadian banks may return positive for expenses, but we'll use category/description first
                  isExpense = plaidTx.amount < 0;
                }
              }
            }
          }
        }
        
        console.log('[PLAID SYNC] Determining transaction type:', {
          accountType: account?.type,
          plaidAmount: plaidTx.amount,
          plaidTransactionType, // Log transaction_type from Plaid
          transactionCode: plaidTx.transaction_code,
          category: plaidTx.category,
          categoryPrimary,
          categoryIndicatesExpense,
          categoryIndicatesIncome,
          isExpense,
          description: (plaidTx.name || plaidTx.merchant_name || '').substring(0, 50),
        });
        
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
        
        // Detect credit card payments - these should be transfers, not income
        let type: 'expense' | 'income' | 'transfer' = isExpense ? 'expense' : 'income';
        if (account?.type === 'credit' && !isExpense) {
          // Check if this is a credit card payment (negative amount on credit card = payment)
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
            // transferFromId will be set by user later if needed
            type = 'transfer';
            console.log('[PLAID SYNC] Detected credit card payment, classifying as transfer:', {
              description: description.substring(0, 50),
              amount,
              transactionCode,
            });
          }
        }

        // Convert Plaid transaction to camelCase format for consistent storage
        const convertedTx = convertPlaidTransactionToCamelCase(plaidTx);
        
        // Build Plaid metadata object in camelCase
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
          // For credit card payments (transfers), transferFromId will be null initially
          // User can add it later via the form
          transferFromId: undefined,
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
        // Pass userId for server-side operations (bypasses auth check)
        const transaction = await createTransaction(transactionData, account?.userId || undefined);
        
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
          console.error('Error updating transaction with metadata:', {
            transactionId,
            plaidTransactionId: plaidTx.transaction_id,
            error: updateError,
          });
          errors++;
        } else {
          console.log('Transaction updated with Plaid metadata:', {
            transactionId,
            hasMetadata: !!plaidMetadata,
            pending: plaidMetadata.pending,
            hasCategory: !!plaidMetadata.category,
            suggestedCategoryId: categorySuggestion?.categoryId,
          });

          // Record sync only if update was successful
          // Use upsert to handle race conditions - if another sync created it, just update
          const syncId = crypto.randomUUID();
          const now = formatTimestamp(new Date());

          const { error: syncError } = await supabase
            .from('TransactionSync')
            .upsert({
              id: syncId,
              accountId,
              plaidTransactionId: plaidTx.transaction_id,
              transactionId: transactionId,
              householdId: account?.householdId || null,
              syncDate: now,
              status: 'synced',
            }, {
              onConflict: 'plaidTransactionId',
              ignoreDuplicates: false,
            });

          if (syncError) {
            // Check if it's a duplicate key error (race condition)
            if (syncError.code === '23505' || syncError.message?.includes('duplicate') || syncError.message?.includes('unique')) {
              console.warn('[PLAID SYNC] TransactionSync already exists (race condition):', plaidTx.transaction_id);
              // Transaction was already synced by another process - this is OK
              skipped++;
            } else {
              console.error('Error recording transaction sync:', {
                transactionId,
                plaidTransactionId: plaidTx.transaction_id,
                error: syncError,
              });
              errors++;
            }
          } else {
            synced++;
            // Update in-memory map to prevent duplicates in same batch
            syncedMap.set(plaidTx.transaction_id, transactionId);
          }
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
            householdId: account?.householdId || null,
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
          // Use transaction_type as primary indicator (most reliable for US/Canada)
          const plaidTransactionType = (plaidTx as any).transaction_type || null;
          let isExpense: boolean;
          
          if (plaidTransactionType === 'place' || plaidTransactionType === 'digital') {
            // "place" = physical purchase, "digital" = online purchase - both are expenses
            isExpense = true;
          } else {
            // For other types or null, use amount sign as fallback
            isExpense = plaidTx.amount < 0;
          }
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

          // Pass userId for server-side operations (bypasses auth check)
          const transaction = await createTransaction(transactionData, account?.userId || undefined);
          const transactionId = (transaction as any).id || (transaction as any).outgoing?.id || null;
          
          if (transactionId) {
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

            const { error: updateError2 } = await supabase
              .from('Transaction')
              .update({ plaidMetadata: plaidMetadata as any })
              .eq('id', transactionId);

            if (updateError2) {
              console.error('Error updating modified transaction (as new) with metadata:', {
                transactionId,
                plaidTransactionId: plaidTx.transaction_id,
                error: updateError2,
              });
              errors++;
            } else {
              console.log('Modified transaction (as new) updated with Plaid metadata:', {
                transactionId,
                hasMetadata: !!plaidMetadata,
                pending: plaidMetadata.pending,
              });

              const { error: syncError } = await supabase
                .from('TransactionSync')
                .insert({
                  id: crypto.randomUUID(),
                  accountId,
                  plaidTransactionId: plaidTx.transaction_id,
                  transactionId: transactionId,
                  householdId: account?.householdId || null,
                  syncDate: formatTimestamp(new Date()),
                  status: 'synced',
                });

              if (syncError) {
                console.error('Error creating TransactionSync record:', syncError);
                errors++;
              } else {
                synced++;
              }
            }
          }
        } catch (error) {
          console.error('Error processing modified transaction (as new):', plaidTx.transaction_id, error);
          errors++;
        }
        } else {
          // Update existing transaction
        try {
          // Use same logic as for new transactions
          // First, check transaction_type (most reliable for US/Canada)
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
          
          if (account?.type === 'credit') {
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
                const hasMerchantName = !!(plaidTx.merchant_name || plaidTx.name);
                if (hasMerchantName && !categoryIndicatesIncome) {
                  isExpense = true;
                } else {
                  isExpense = plaidTx.amount < 0;
                }
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
          const plaidDate = new Date(plaidTx.date + 'T00:00:00');
          const description = plaidTx.name || plaidTx.merchant_name || plaidTx.original_description || 'Plaid Transaction';
          const amount = Math.abs(plaidTx.amount);
          const type = isExpense ? 'expense' : 'income';

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

          const { error: updateError3 } = await supabase
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

          if (updateError3) {
            console.error('Error updating existing transaction with metadata:', {
              transactionId: existingTransactionId,
              plaidTransactionId: plaidTx.transaction_id,
              error: updateError3,
            });
            errors++;
          } else {
            console.log('Existing transaction updated with Plaid metadata:', {
              transactionId: existingTransactionId,
              hasMetadata: !!plaidMetadata,
              pending: plaidMetadata.pending,
            });

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
              // Don't increment errors for this, as the main transaction was updated successfully
            }
          }
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
    
    // Extract Plaid-specific error details
    const plaidError = error.response?.data;
    if (plaidError?.error_code && plaidError?.error_message) {
      // Create a more informative error message with Plaid error details
      const errorMessage = `${plaidError.error_message} (${plaidError.error_code})`;
      const enhancedError = new Error(errorMessage);
      // Preserve Plaid error code for potential frontend handling
      (enhancedError as any).plaidErrorCode = plaidError.error_code;
      (enhancedError as any).plaidErrorType = plaidError.error_type;
      throw enhancedError;
    }
    
    // Fallback to generic error message
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

