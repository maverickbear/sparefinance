"use server";

import { plaidClient } from './index';
import { createServerClient } from '@/lib/supabase-server';
import { formatTimestamp } from '@/lib/utils/timestamp';
import { InvestmentTransactionType } from 'plaid';

/**
 * Map Plaid security type to our security class
 */
function mapPlaidSecurityTypeToClass(plaidType: string | undefined | null): "stock" | "etf" | "crypto" | "bond" | "reit" {
  if (!plaidType) return "stock";
  
  const normalizedType = plaidType.toLowerCase().trim();
  
  // Map common Plaid types to our classes
  if (normalizedType.includes("etf") || normalizedType === "etf") {
    return "etf";
  }
  if (normalizedType.includes("crypto") || normalizedType === "crypto") {
    return "crypto";
  }
  if (normalizedType.includes("bond") || normalizedType === "bond") {
    return "bond";
  }
  if (normalizedType.includes("reit") || normalizedType === "reit") {
    return "reit";
  }
  if (normalizedType.includes("mutual") || normalizedType === "mutual fund") {
    return "etf"; // Treat mutual funds as ETFs
  }
  
  // Default to stock
  return "stock";
}

/**
 * Sync investment accounts, holdings, and transactions from Plaid
 */
export async function syncInvestmentAccounts(
  itemId: string,
  accessToken: string
): Promise<{
  accountsSynced: number;
  holdingsSynced: number;
  transactionsSynced: number;
  errors: number;
}> {
  const supabase = await createServerClient();
  let accountsSynced = 0;
  let holdingsSynced = 0;
  let transactionsSynced = 0;
  let errors = 0;

  try {
    // Get investment accounts from Plaid
    // Note: /accounts/get returns cached information, not real-time balances
    // For investment accounts, balances are typically calculated from holdings,
    // so we use /accounts/get for metadata and calculate balances from holdings separately
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const investmentAccounts = accountsResponse.data.accounts.filter(
      (account) => account.type === 'investment'
    );

    if (investmentAccounts.length === 0) {
      return { accountsSynced: 0, holdingsSynced: 0, transactionsSynced: 0, errors: 0 };
    }

    // Get holdings for all investment accounts
    const holdingsResponse = await plaidClient.investmentsHoldingsGet({
      access_token: accessToken,
    });

    const holdings = holdingsResponse.data.holdings || [];
    const securities = holdingsResponse.data.securities || [];

    // Get investment transactions with pagination support
    // Plaid's investmentsTransactionsGet may return paginated results for large datasets
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 730); // Last 2 years

    let allInvestmentTransactions: any[] = [];
    let hasMoreTransactions = true;
    let offset = 0;
    const pageSize = 500; // Plaid's default page size

    // Fetch all investment transactions with pagination
    while (hasMoreTransactions) {
      try {
        const transactionsResponse = await plaidClient.investmentsTransactionsGet({
          access_token: accessToken,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          options: {
            offset: offset,
            count: pageSize,
          },
        });

        const transactions = transactionsResponse.data.investment_transactions || [];
        const totalTransactions = (transactionsResponse.data as any).total_investment_transactions || transactions.length;

        allInvestmentTransactions.push(...transactions);

        // Check if there are more transactions to fetch
        if (transactions.length < pageSize || allInvestmentTransactions.length >= totalTransactions) {
          hasMoreTransactions = false;
        } else {
          offset += pageSize;
        }

        // Safety check to prevent infinite loops
        if (offset > 10000) {
          console.warn('[PLAID INVESTMENTS] Reached maximum offset limit, stopping pagination');
          hasMoreTransactions = false;
        }
      } catch (error: any) {
        // If pagination options are not supported, fall back to single request
        if (error.message?.includes('options') || error.code === 'INVALID_REQUEST' || offset === 0) {
          console.log('[PLAID INVESTMENTS] Pagination not supported or error on first request, using single request');
          try {
            const transactionsResponse = await plaidClient.investmentsTransactionsGet({
              access_token: accessToken,
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
            });
            allInvestmentTransactions = transactionsResponse.data.investment_transactions || [];
          } catch (fallbackError: any) {
            console.error('[PLAID INVESTMENTS] Error in fallback transaction fetch:', fallbackError);
            throw fallbackError;
          }
        } else {
          console.error('[PLAID INVESTMENTS] Error fetching transactions:', error);
          // If we already have some transactions, use them and continue
          if (allInvestmentTransactions.length > 0) {
            console.warn(`[PLAID INVESTMENTS] Using ${allInvestmentTransactions.length} transactions fetched before error`);
          } else {
            throw error;
          }
        }
        hasMoreTransactions = false;
      }
    }

    const investmentTransactions = allInvestmentTransactions;
    console.log(`[PLAID INVESTMENTS] Fetched ${investmentTransactions.length} investment transactions`);

    // Process each investment account
    for (const plaidAccount of investmentAccounts) {
      try {
        // Find or create the account in our database
        const { data: existingAccount } = await supabase
          .from('Account')
          .select('id, householdId')
          .eq('plaidAccountId', plaidAccount.account_id)
          .single();

        let accountId: string;
        let householdId: string | null = null;

        if (existingAccount) {
          accountId = existingAccount.id;
          householdId = existingAccount.householdId;
        } else {
          // Account should have been created in exchange-public-token
          // But if it wasn't, we'll skip it
          console.warn(`Investment account not found for Plaid account ID: ${plaidAccount.account_id}`);
          continue;
        }

        accountsSynced++;

        // Process holdings for this account
        const accountHoldings = holdings.filter(
          (holding) => holding.account_id === plaidAccount.account_id
        );

        // Calculate total account value by summing all holdings
        let totalAccountValue = 0;

        for (const holding of accountHoldings) {
          try {
            // Find the security
            const security = securities.find((s) => s.security_id === holding.security_id);
            if (!security) {
              console.warn(`Security not found for holding: ${holding.security_id}`);
              continue;
            }

            // Normalize symbol for matching - Plaid may use different formats
            const plaidSymbol = security.ticker_symbol || security.name || '';
            const normalizedPlaidSymbol = plaidSymbol.toUpperCase().trim();
            
            // Find or create Security in our database
            // Try exact match first, then try case-insensitive match
            let securityId: string;
            let { data: existingSecurity } = await supabase
              .from('Security')
              .select('id')
              .eq('symbol', normalizedPlaidSymbol)
              .single();

            // If not found, try case-insensitive search
            if (!existingSecurity && normalizedPlaidSymbol) {
              const { data: securitiesList } = await supabase
                .from('Security')
                .select('id, symbol')
                .ilike('symbol', normalizedPlaidSymbol);
              
              if (securitiesList && securitiesList.length > 0) {
                existingSecurity = securitiesList[0];
              }
            }

            if (existingSecurity) {
              securityId = existingSecurity.id;
              
              // Update security with latest price and currency if available
              const updateData: any = {
                updatedAt: formatTimestamp(new Date()),
              };
              
              if ((security as any).close_price !== undefined && (security as any).close_price !== null) {
                updateData.closePrice = (security as any).close_price;
                updateData.closePriceAsOf = formatTimestamp(new Date());
              }
              
              if ((security as any).iso_currency_code) {
                updateData.currencyCode = (security as any).iso_currency_code;
              }
              
              if (Object.keys(updateData).length > 1) { // More than just updatedAt
                await supabase
                  .from('Security')
                  .update(updateData)
                  .eq('id', securityId);
              }
            } else {
              // Create new Security
              securityId = crypto.randomUUID();
              const securityClass = mapPlaidSecurityTypeToClass(security.type);
              
              console.log(`[PLAID INVESTMENTS] Creating new security: ${normalizedPlaidSymbol} (${security.name || 'Unknown'}) - type: ${security.type} -> class: ${securityClass}`);
              
              const { error: securityError } = await supabase.from('Security').insert({
                id: securityId,
                symbol: normalizedPlaidSymbol || 'UNKNOWN',
                name: security.name || security.ticker_symbol || 'Unknown Security',
                class: securityClass,
                sector: null, // Plaid doesn't provide sector
                closePrice: (security as any).close_price || null,
                closePriceAsOf: (security as any).close_price ? formatTimestamp(new Date()) : null,
                currencyCode: (security as any).iso_currency_code || null,
                createdAt: formatTimestamp(new Date()),
                updatedAt: formatTimestamp(new Date()),
              });

              if (securityError) {
                console.error(`[PLAID INVESTMENTS] Error creating security ${normalizedPlaidSymbol}:`, securityError);
                errors++;
                continue;
              }
            }

            // Calculate holding values
            const holdingQuantity = holding.quantity || 0;
            const holdingValue = holding.institution_value || 0;
            const currentPrice = holdingValue > 0 && holdingQuantity > 0 
              ? holdingValue / holdingQuantity 
              : (security as any).close_price || 0;
            const averagePrice = holding.cost_basis?.amount 
              ? holding.cost_basis.amount / (holdingQuantity || 1)
              : currentPrice;
            const totalCost = holding.cost_basis?.amount || (averagePrice * holdingQuantity);
            const openPnl = holdingValue - totalCost;

            // Store or update Position (holding) in database
            const now = formatTimestamp(new Date());
            const { data: existingPosition } = await supabase
              .from('Position')
              .select('id')
              .eq('accountId', accountId)
              .eq('securityId', securityId)
              .single();

            if (existingPosition) {
              // Update existing position
              const { error: positionError } = await supabase
                .from('Position')
                .update({
                  openQuantity: holdingQuantity,
                  currentMarketValue: holdingValue,
                  currentPrice: currentPrice,
                  averageEntryPrice: averagePrice,
                  totalCost: totalCost,
                  openPnl: openPnl,
                  lastUpdatedAt: now,
                  updatedAt: now,
                })
                .eq('id', existingPosition.id);

              if (positionError) {
                console.error('Error updating position:', positionError);
                errors++;
              } else {
                holdingsSynced++;
              }
            } else {
              // Create new position
              const positionId = crypto.randomUUID();
              const { error: positionError } = await supabase
                .from('Position')
                .insert({
                  id: positionId,
                  accountId: accountId,
                  securityId: securityId,
                  openQuantity: holdingQuantity,
                  closedQuantity: 0,
                  currentMarketValue: holdingValue,
                  currentPrice: currentPrice,
                  averageEntryPrice: averagePrice,
                  closedPnl: 0,
                  openPnl: openPnl,
                  totalCost: totalCost,
                  isRealTime: false,
                  isUnderReorg: false,
                  lastUpdatedAt: now,
                  createdAt: now,
                  updatedAt: now,
                  householdId: householdId,
                });

              if (positionError) {
                console.error('Error creating position:', positionError);
                errors++;
              } else {
                holdingsSynced++;
              }
            }

            // Sum the holding value to total account value
            totalAccountValue += holdingValue;
          } catch (error) {
            console.error('Error processing holding:', error);
            errors++;
          }
        }

        // Fallback: If holdings sum is 0 or very low, use account balance from Plaid
        // This ensures we have a balance even if holdings aren't properly synced
        if (totalAccountValue === 0 || totalAccountValue < 0.01) {
          const plaidBalance = plaidAccount.balances?.current ?? plaidAccount.balances?.available ?? null;
          if (plaidBalance !== null && plaidBalance > 0) {
            console.log(`[PLAID INVESTMENTS] Using Plaid account balance as fallback for account ${plaidAccount.account_id}: ${plaidBalance}`);
            totalAccountValue = plaidBalance;
          }
        }

        // Store or update total account value in AccountInvestmentValue
        // This is the sum of all holdings for this account (or Plaid balance as fallback)
        const { data: existingValue } = await supabase
          .from('AccountInvestmentValue')
          .select('id')
          .eq('accountId', accountId)
          .single();

        if (existingValue) {
          await supabase
            .from('AccountInvestmentValue')
            .update({
              totalValue: totalAccountValue,
              updatedAt: formatTimestamp(new Date()),
            })
            .eq('id', existingValue.id);
        } else {
          await supabase.from('AccountInvestmentValue').insert({
            id: crypto.randomUUID(),
            accountId: accountId,
            totalValue: totalAccountValue,
            createdAt: formatTimestamp(new Date()),
            updatedAt: formatTimestamp(new Date()),
          });
        }

        // Process investment transactions for this account
        const accountTransactions = investmentTransactions.filter(
          (tx) => tx.account_id === plaidAccount.account_id
        );

        // Get already synced transaction IDs - use plaidInvestmentTransactionId if available for better deduplication
        const { data: syncedTransactions } = await supabase
          .from('InvestmentTransaction')
          .select('id, plaidInvestmentTransactionId, date, type, quantity, price, securityId')
          .eq('accountId', accountId);

        // Create map using plaidInvestmentTransactionId (preferred) or fallback to composite key
        const syncedTxMap = new Map<string, string>();
        syncedTransactions?.forEach((t) => {
          if (t.plaidInvestmentTransactionId) {
            syncedTxMap.set(t.plaidInvestmentTransactionId, t.id);
          } else {
            // Fallback to composite key for old transactions without plaidInvestmentTransactionId
            const txKey = `${t.date}-${t.type}-${t.quantity}-${t.price}-${t.securityId}`;
            syncedTxMap.set(txKey, t.id);
          }
        });

        for (const plaidTx of accountTransactions) {
          try {
            // Check if transaction already exists - prefer plaidInvestmentTransactionId
            const plaidTxId = plaidTx.investment_transaction_id;
            if (plaidTxId && syncedTxMap.has(plaidTxId)) {
              continue; // Skip already synced transactions
            }
            
            // Fallback to composite key if plaidInvestmentTransactionId is not available
            const txKey = `${plaidTx.date}-${plaidTx.type}-${plaidTx.quantity || 0}-${plaidTx.price || 0}-${plaidTx.security_id || ''}`;
            if (!plaidTxId && syncedTxMap.has(txKey)) {
              continue; // Skip already synced transactions
            }

            // Find or create Security
            const security = securities.find((s) => s.security_id === plaidTx.security_id);
            if (!security) {
              console.warn(`[PLAID INVESTMENTS] Security not found for transaction: ${plaidTx.security_id}`);
              continue;
            }

            // Normalize symbol for matching - same as for holdings
            const plaidTxSymbol = security.ticker_symbol || security.name || '';
            const normalizedTxSymbol = plaidTxSymbol.toUpperCase().trim();
            
            let securityId: string;
            // Try exact match first, then try case-insensitive match
            let { data: existingSecurity } = await supabase
              .from('Security')
              .select('id')
              .eq('symbol', normalizedTxSymbol)
              .single();

            // If not found, try case-insensitive search
            if (!existingSecurity && normalizedTxSymbol) {
              const { data: securitiesList } = await supabase
                .from('Security')
                .select('id, symbol')
                .ilike('symbol', normalizedTxSymbol);
              
              if (securitiesList && securitiesList.length > 0) {
                existingSecurity = securitiesList[0];
              }
            }

            if (existingSecurity) {
              securityId = existingSecurity.id;
              
              // Update security with latest price and currency if available
              const updateData: any = {
                updatedAt: formatTimestamp(new Date()),
              };
              
              if ((security as any).close_price !== undefined && (security as any).close_price !== null) {
                updateData.closePrice = (security as any).close_price;
                updateData.closePriceAsOf = formatTimestamp(new Date());
              }
              
              if ((security as any).iso_currency_code) {
                updateData.currencyCode = (security as any).iso_currency_code;
              }
              
              if (Object.keys(updateData).length > 1) { // More than just updatedAt
                await supabase
                  .from('Security')
                  .update(updateData)
                  .eq('id', securityId);
              }
            } else {
              // Create new Security
              securityId = crypto.randomUUID();
              const normalizedTxSymbol = (security.ticker_symbol || security.name || '').toUpperCase().trim();
              const securityClass = mapPlaidSecurityTypeToClass(security.type);
              
              console.log(`[PLAID INVESTMENTS] Creating new security from transaction: ${normalizedTxSymbol} (${security.name || 'Unknown'}) - type: ${security.type} -> class: ${securityClass}`);
              
              await supabase.from('Security').insert({
                id: securityId,
                symbol: normalizedTxSymbol || 'UNKNOWN',
                name: security.name || security.ticker_symbol || 'Unknown Security',
                class: securityClass,
                sector: null,
                closePrice: (security as any).close_price || null,
                closePriceAsOf: (security as any).close_price ? formatTimestamp(new Date()) : null,
                currencyCode: (security as any).iso_currency_code || null,
                createdAt: formatTimestamp(new Date()),
                updatedAt: formatTimestamp(new Date()),
              });
            }

            // Map Plaid transaction type to our transaction type
            let transactionType = 'buy';
            if (plaidTx.type === InvestmentTransactionType.Sell) {
              transactionType = 'sell';
            } else if (plaidTx.type === InvestmentTransactionType.Transfer) {
              transactionType = 'transfer';
            } else if (plaidTx.type === InvestmentTransactionType.Cash) {
              // Cash transactions might include dividends
              // Check the transaction name to determine if it's a dividend
              const txName = (plaidTx.name || '').toLowerCase();
              if (txName.includes('dividend')) {
                transactionType = 'dividend';
              } else {
                transactionType = 'buy'; // Default cash transaction to buy
              }
            } else if (plaidTx.type === InvestmentTransactionType.Fee) {
              transactionType = 'buy'; // Fees are treated as buy transactions
            } else {
              // Check transaction name or subtype for dividend/interest
              // Plaid InvestmentTransactionType enum only has: Buy, Sell, Cancel, Cash, Fee, Transfer
              // Dividends and interest may come as Cash transactions or have specific names
              const txName = (plaidTx.name || '').toLowerCase();
              const txSubtype = ((plaidTx as any).subtype || '').toLowerCase();
              
              if (txName.includes('interest') || txSubtype.includes('interest')) {
                transactionType = 'interest';
              } else if (txName.includes('dividend') || txSubtype.includes('dividend')) {
                transactionType = 'dividend';
              }
              // If none match, transactionType remains 'buy' (default)
            }

            // Get currency code from transaction or security
            const currencyCode = (plaidTx as any).iso_currency_code || null;

            // Create investment transaction
            const transactionId = crypto.randomUUID();
            const txDate = new Date(plaidTx.date + 'T00:00:00');

            const { error: txError } = await supabase.from('InvestmentTransaction').insert({
              id: transactionId,
              accountId: accountId,
              securityId: securityId,
              date: formatTimestamp(txDate),
              type: transactionType,
              quantity: plaidTx.quantity || null,
              price: plaidTx.price || null,
              fees: plaidTx.fees || 0,
              notes: plaidTx.name || null,
              plaidInvestmentTransactionId: plaidTx.investment_transaction_id || null,
              plaidSubtype: (plaidTx as any).subtype || null,
              currencyCode: currencyCode,
              createdAt: formatTimestamp(new Date()),
              updatedAt: formatTimestamp(new Date()),
            });

            if (txError) {
              console.error('Error creating investment transaction:', txError);
              errors++;
            } else {
              transactionsSynced++;
            }
          } catch (error) {
            console.error('Error processing investment transaction:', error);
            errors++;
          }
        }
      } catch (error) {
        console.error(`Error processing investment account ${plaidAccount.account_id}:`, error);
        errors++;
      }
    }

    return { accountsSynced, holdingsSynced, transactionsSynced, errors };
  } catch (error: any) {
    console.error('Error syncing investment accounts:', error);
    throw new Error(error.message || 'Failed to sync investment accounts');
  }
}

