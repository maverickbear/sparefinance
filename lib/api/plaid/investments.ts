"use server";

import { plaidClient } from './index';
import { createServerClient } from '@/lib/supabase-server';
import { formatTimestamp } from '@/lib/utils/timestamp';

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

    // Get investment transactions
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 730); // Last 2 years

    const transactionsResponse = await plaidClient.investmentsTransactionsGet({
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });

    const investmentTransactions = transactionsResponse.data.investment_transactions || [];

    // Process each investment account
    for (const plaidAccount of investmentAccounts) {
      try {
        // Find or create the account in our database
        const { data: existingAccount } = await supabase
          .from('Account')
          .select('id')
          .eq('plaidAccountId', plaidAccount.account_id)
          .single();

        let accountId: string;

        if (existingAccount) {
          accountId = existingAccount.id;
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

        for (const holding of accountHoldings) {
          try {
            // Find the security
            const security = securities.find((s) => s.security_id === holding.security_id);
            if (!security) {
              console.warn(`Security not found for holding: ${holding.security_id}`);
              continue;
            }

            // Find or create Security in our database
            let securityId: string;
            const { data: existingSecurity } = await supabase
              .from('Security')
              .select('id')
              .eq('symbol', security.ticker_symbol || security.name)
              .single();

            if (existingSecurity) {
              securityId = existingSecurity.id;
            } else {
              // Create new Security
              securityId = crypto.randomUUID();
              const { error: securityError } = await supabase.from('Security').insert({
                id: securityId,
                symbol: security.ticker_symbol || security.name || 'UNKNOWN',
                name: security.name || security.ticker_symbol || 'Unknown Security',
                class: security.type || 'other',
                sector: null, // Plaid doesn't provide sector
                createdAt: formatTimestamp(new Date()),
                updatedAt: formatTimestamp(new Date()),
              });

              if (securityError) {
                console.error('Error creating security:', securityError);
                errors++;
                continue;
              }
            }

            // Store or update holding in AccountInvestmentValue
            // Note: We're storing the total value here, not individual holdings
            // For detailed holdings tracking, we'd need a separate Holdings table
            const totalValue = holding.institution_value || 0;

            const { data: existingValue } = await supabase
              .from('AccountInvestmentValue')
              .select('id')
              .eq('accountId', accountId)
              .single();

            if (existingValue) {
              await supabase
                .from('AccountInvestmentValue')
                .update({
                  totalValue: totalValue,
                  updatedAt: formatTimestamp(new Date()),
                })
                .eq('id', existingValue.id);
            } else {
              await supabase.from('AccountInvestmentValue').insert({
                id: crypto.randomUUID(),
                accountId: accountId,
                totalValue: totalValue,
                createdAt: formatTimestamp(new Date()),
                updatedAt: formatTimestamp(new Date()),
              });
            }

            holdingsSynced++;
          } catch (error) {
            console.error('Error processing holding:', error);
            errors++;
          }
        }

        // Process investment transactions for this account
        const accountTransactions = investmentTransactions.filter(
          (tx) => tx.account_id === plaidAccount.account_id
        );

        // Get already synced transaction IDs
        const { data: syncedTransactions } = await supabase
          .from('InvestmentTransaction')
          .select('id, date, type, quantity, price, securityId')
          .eq('accountId', accountId);

        const syncedTxMap = new Map(
          syncedTransactions?.map((t) => [
            `${t.date}-${t.type}-${t.quantity}-${t.price}-${t.securityId}`,
            t.id,
          ]) || []
        );

        for (const plaidTx of accountTransactions) {
          try {
            // Check if transaction already exists
            const txKey = `${plaidTx.date}-${plaidTx.type}-${plaidTx.quantity || 0}-${plaidTx.price || 0}-${plaidTx.security_id || ''}`;
            if (syncedTxMap.has(txKey)) {
              continue; // Skip already synced transactions
            }

            // Find or create Security
            const security = securities.find((s) => s.security_id === plaidTx.security_id);
            if (!security) {
              console.warn(`Security not found for transaction: ${plaidTx.security_id}`);
              continue;
            }

            let securityId: string;
            const { data: existingSecurity } = await supabase
              .from('Security')
              .select('id')
              .eq('symbol', security.ticker_symbol || security.name)
              .single();

            if (existingSecurity) {
              securityId = existingSecurity.id;
            } else {
              // Create new Security
              securityId = crypto.randomUUID();
              await supabase.from('Security').insert({
                id: securityId,
                symbol: security.ticker_symbol || security.name || 'UNKNOWN',
                name: security.name || security.ticker_symbol || 'Unknown Security',
                class: security.type || 'other',
                sector: null,
                createdAt: formatTimestamp(new Date()),
                updatedAt: formatTimestamp(new Date()),
              });
            }

            // Map Plaid transaction type to our transaction type
            let transactionType = 'buy';
            if (plaidTx.type === 'sell') {
              transactionType = 'sell';
            } else if (plaidTx.type === 'dividend') {
              transactionType = 'dividend';
            } else if (plaidTx.type === 'transfer') {
              transactionType = 'transfer';
            }

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

