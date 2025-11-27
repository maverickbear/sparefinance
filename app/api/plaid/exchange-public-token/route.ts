import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { exchangePublicToken, syncAccountBalances } from '@/lib/api/plaid/connect';
import { syncAccountTransactions } from '@/lib/api/plaid/sync';
import { syncAccountLiabilities } from '@/lib/api/plaid/liabilities';
import { syncInvestmentAccounts } from '@/lib/api/plaid/investments';
import { guardBankIntegration, getCurrentUserId } from '@/lib/api/feature-guard';
import { throwIfNotAllowed } from '@/lib/api/feature-guard';
import { formatTimestamp, formatDateOnly, parseDateWithoutTimezone } from '@/lib/utils/timestamp';
import { getActiveCreditCardDebt, calculateNextDueDate } from '@/lib/utils/credit-card-debt';
import { createDebt } from '@/lib/api/debts';
import { plaidClient } from '@/lib/api/plaid/index';

export async function POST(req: NextRequest) {
  try {
    // Get current user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has access to bank integration
    const guardResult = await guardBankIntegration(userId);
    await throwIfNotAllowed(guardResult);

    const supabase = await createServerClient();
    const now = formatTimestamp(new Date());

    // Parse request body
    const body = await req.json();
    const { publicToken, metadata, accountTypeMappings, itemId: providedItemId } = body;

    // accountTypeMappings is optional - if provided, it maps plaidAccountId to account type
    // Format: { [plaidAccountId]: 'checking' | 'savings' | 'credit' | 'investment' | 'other' }
    
    let itemId: string;
    let accessToken: string;
    let accounts: any[];

    // If itemId is provided, connection was already created in preview
    // Otherwise, do the exchange now
    let institutionMetadata: { institution_id?: string; name?: string } | null = null;
    
    if (providedItemId) {
      console.log('[PLAID EXCHANGE] Using existing connection from preview:', providedItemId);
      
      // Get connection from database (includes institution info)
      const { data: connection, error: connectionError } = await supabase
        .from('PlaidConnection')
        .select('itemId, accessToken, userId, institutionId, institutionName')
        .eq('itemId', providedItemId)
        .single();

      if (connectionError || !connection) {
        console.error('[PLAID EXCHANGE] Connection not found:', {
          itemId: providedItemId,
          error: connectionError,
        });
        return NextResponse.json(
          { error: 'Plaid connection not found. Please try connecting again.' },
          { status: 400 }
        );
      }

      // Verify the connection belongs to the current user
      if (connection.userId !== userId) {
        console.error('[PLAID EXCHANGE] User mismatch:', {
          connectionUserId: connection.userId,
          currentUserId: userId,
        });
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }

      itemId = connection.itemId;
      accessToken = connection.accessToken;
      
      // Build institution metadata from connection data
      institutionMetadata = {
        institution_id: connection.institutionId || undefined,
        name: connection.institutionName || undefined,
      };

      // Get accounts using access token
      const { plaidClient } = await import('@/lib/api/plaid/index');
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });
      accounts = accountsResponse.data.accounts;
      console.log('[PLAID EXCHANGE] Retrieved accounts from existing connection:', {
        itemId,
        accountCount: accounts.length,
        institution: institutionMetadata.name,
      });
    } else {
      // Original flow: exchange token and create connection
      if (!publicToken || !metadata) {
        return NextResponse.json(
          { error: 'Missing publicToken or metadata' },
          { status: 400 }
        );
      }

      institutionMetadata = metadata.institution || null;

      const exchangeResult = await exchangePublicToken(
        publicToken,
        metadata
      );
      itemId = exchangeResult.itemId;
      accessToken = exchangeResult.accessToken;
      accounts = exchangeResult.accounts;
    }

    // Get active household ID for the user
    const { getActiveHouseholdId } = await import('@/lib/utils/household');
    const householdId = await getActiveHouseholdId(userId);
    if (!householdId) {
      console.error('[PLAID] No active household found for user:', userId);
      return NextResponse.json(
        { error: 'No active household found. Please contact support.' },
        { status: 400 }
      );
    }

    // Verify PlaidConnection exists for this itemId
    // This ensures data integrity - accounts should only be created if connection exists
    const { data: connectionCheck, error: connectionCheckError } = await supabase
      .from('PlaidConnection')
      .select('id, itemId, userId')
      .eq('itemId', itemId)
      .single();

    if (connectionCheckError || !connectionCheck) {
      console.error('PlaidConnection not found for itemId:', itemId);
      return NextResponse.json(
        { error: 'Plaid connection not found. Please try connecting again.' },
        { status: 400 }
      );
    }

    // Verify the connection belongs to the current user
    if (connectionCheck.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Determine default currency - use USD as default, will be overridden by account balances if available
    // The currencyCode from account balances.iso_currency_code will be used when available
    const defaultCurrency = 'USD';

    // Validate accountTypeMappings if provided
    if (accountTypeMappings) {
      const plaidAccountIds = accounts.map(acc => acc.account_id);
      const mappingKeys = Object.keys(accountTypeMappings);
      
      // Check if all accounts have mappings
      const missingMappings = plaidAccountIds.filter(id => !accountTypeMappings[id]);
      if (missingMappings.length > 0) {
        console.error('[PLAID EXCHANGE] Missing account type mappings:', missingMappings);
        return NextResponse.json(
          { error: `Missing account type mappings for ${missingMappings.length} account(s)` },
          { status: 400 }
        );
      }
      
      // Check if all mappings are valid account types
      const validTypes = ['checking', 'savings', 'credit', 'investment', 'other'];
      const invalidMappings = mappingKeys.filter(key => !validTypes.includes(accountTypeMappings[key]));
      if (invalidMappings.length > 0) {
        console.error('[PLAID EXCHANGE] Invalid account type mappings:', invalidMappings);
        return NextResponse.json(
          { error: `Invalid account type mappings: ${invalidMappings.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Create or update accounts for each Plaid account
    const createdAccounts = [];

    for (const plaidAccount of accounts) {
      // Check if account already exists
      const { data: existingAccount } = await supabase
        .from('Account')
        .select('id')
        .eq('plaidAccountId', plaidAccount.account_id)
        .single();

      // Map Plaid account type to our account type
      // Use custom mapping if provided, otherwise use automatic mapping
      let accountType: 'checking' | 'savings' | 'credit' | 'investment' | 'other' = 'checking';
      
      // Check if user provided custom type mapping
      if (accountTypeMappings && accountTypeMappings[plaidAccount.account_id]) {
        const customType = accountTypeMappings[plaidAccount.account_id];
        
        // Validate type compatibility (warn but allow - user knows best)
        const plaidType = plaidAccount.type?.toLowerCase();
        if (plaidType === 'investment' && customType !== 'investment') {
          console.warn(`[PLAID] Warning: Plaid type is 'investment' but user selected '${customType}' for ${plaidAccount.name}`);
        } else if (plaidType === 'credit' && customType !== 'credit') {
          console.warn(`[PLAID] Warning: Plaid type is 'credit' but user selected '${customType}' for ${plaidAccount.name}`);
        }
        
        accountType = customType;
        console.log(`[PLAID] Using custom account type mapping: ${plaidAccount.name} -> ${accountType}`);
      } else {
        // Use automatic mapping based on Plaid account type
        const plaidType = plaidAccount.type?.toLowerCase();
        const plaidSubtype = plaidAccount.subtype?.toLowerCase();
        
        if (plaidType === 'depository') {
          // Depository accounts: checking, savings, CDs, money market, etc.
          // Use subtype to determine checking vs savings
          if (plaidSubtype === 'savings' || 
              plaidSubtype === 'cd' || 
              plaidSubtype === 'money market' ||
              plaidSubtype === 'savings account') {
            accountType = 'savings';
          } else if (plaidSubtype === 'checking' || 
                     plaidSubtype === 'checking account') {
            accountType = 'checking';
          } else {
            // Default to checking for paypal, prepaid, etc. when subtype is not clear
            accountType = 'checking';
          }
        } else if (plaidType === 'credit') {
          // Credit card accounts
          accountType = 'credit';
        } else if (plaidType === 'loan') {
          // Loan accounts (mortgage, auto, student, etc.)
          // Note: 'loan' is not in our Account type enum, so map to 'other'
          // The plaidSubtype will preserve the original loan subtype (mortgage, auto, student, etc.)
          accountType = 'other';
        } else if (plaidType === 'investment') {
          // Investment/brokerage accounts
          accountType = 'investment';
        } else {
          // For other types (brokerage, etc.), default to 'other'
          accountType = 'other';
        }

        // Log account type mapping for debugging
        console.log(`[PLAID] Account type mapping: Plaid type="${plaidType}", subtype="${plaidSubtype}" -> Our type="${accountType}" (Account: ${plaidAccount.name})`);
      }

      // Get currency code from Plaid balances
      // According to Plaid docs: iso_currency_code and unofficial_currency_code are mutually exclusive
      // If iso_currency_code is null, unofficial_currency_code will be set (for crypto, etc.)
      const isoCurrencyCode = plaidAccount.balances?.iso_currency_code ?? null;
      const unofficialCurrencyCode = plaidAccount.balances?.unofficial_currency_code ?? null;
      
      // Determine currency code based on Plaid response
      // If ISO currency exists, use it; otherwise use unofficial (crypto), or default
      let currencyCode: string | null;
      let finalUnofficialCurrencyCode: string | null;
      
      if (isoCurrencyCode) {
        currencyCode = isoCurrencyCode;
        finalUnofficialCurrencyCode = null;
      } else if (unofficialCurrencyCode) {
        currencyCode = null; // Don't use default for crypto
        finalUnofficialCurrencyCode = unofficialCurrencyCode;
      } else {
        currencyCode = defaultCurrency; // Fallback to default
        finalUnofficialCurrencyCode = null;
      }
      
      // Get credit limit from Plaid balances for credit accounts
      // Note: balances come from /accounts/balance/get (real-time) not /accounts/get (cached)
      // The limit property exists for credit accounts but may not be in the type definition
      const creditLimit = accountType === 'credit' && (plaidAccount.balances as any)?.limit 
        ? (plaidAccount.balances as any).limit 
        : null;

      // Get available balance (separate from current balance)
      // Available balance is the amount that can be withdrawn
      const availableBalance = plaidAccount.balances?.available ?? null;

      // Get additional Plaid fields
      const persistentAccountId = (plaidAccount as any).persistent_account_id || null;
      const holderCategory = (plaidAccount as any).holder_category || null;
      const verificationName = (plaidAccount as any).verification_name || null;

      if (existingAccount) {
        // Update existing account with all Plaid fields
        const updateData: any = {
          plaidItemId: itemId,
          plaidAccountId: plaidAccount.account_id,
          isConnected: true,
          syncEnabled: true,
          plaidMask: (plaidAccount as any).mask || null,
          plaidOfficialName: (plaidAccount as any).official_name || null,
          plaidVerificationStatus: (plaidAccount as any).verification_status || null,
          plaidSubtype: plaidAccount.subtype || null,
          currencyCode: currencyCode,
          plaidUnofficialCurrencyCode: finalUnofficialCurrencyCode,
          plaidAvailableBalance: availableBalance,
          plaidPersistentAccountId: persistentAccountId,
          plaidHolderCategory: holderCategory,
          plaidVerificationName: verificationName,
          householdId: householdId,
          updatedAt: now,
        };
        
        // Update credit limit if this is a credit account
        if (accountType === 'credit' && creditLimit !== null) {
          updateData.creditLimit = creditLimit;
        }
        
        const { error: updateError } = await supabase
          .from('Account')
          .update(updateData)
          .eq('id', existingAccount.id);

        if (updateError) {
          console.error('Error updating account:', updateError);
          continue;
        }

        createdAccounts.push(existingAccount.id);
      } else {
        // Create new account
        const accountId = crypto.randomUUID();
        // Use current balance if available, otherwise fall back to available balance
        // According to Plaid docs: "If current is null this field is guaranteed not to be null"
        const currentBalance = plaidAccount.balances?.current ?? null;
        const availableBalance = plaidAccount.balances?.available ?? null;
        const initialBalance = currentBalance !== null ? currentBalance : (availableBalance ?? 0);

        const insertData: any = {
          id: accountId,
          name: plaidAccount.name,
          type: accountType,
          plaidItemId: itemId,
          plaidAccountId: plaidAccount.account_id,
          isConnected: true,
          syncEnabled: true,
          initialBalance: accountType === 'checking' || accountType === 'savings' ? initialBalance : null,
          plaidMask: (plaidAccount as any).mask || null,
          plaidOfficialName: (plaidAccount as any).official_name || null,
          plaidVerificationStatus: (plaidAccount as any).verification_status || null,
          plaidSubtype: plaidAccount.subtype || null,
          currencyCode: currencyCode,
          plaidUnofficialCurrencyCode: finalUnofficialCurrencyCode,
          plaidAvailableBalance: availableBalance,
          plaidPersistentAccountId: persistentAccountId,
          plaidHolderCategory: holderCategory,
          plaidVerificationName: verificationName,
          userId: userId,
          householdId: householdId,
          createdAt: now,
          updatedAt: now,
        };
        
        // Set credit limit if this is a credit account
        if (accountType === 'credit' && creditLimit !== null) {
          insertData.creditLimit = creditLimit;
        }

        const { error: insertError } = await supabase
          .from('Account')
          .insert(insertData);

        if (insertError) {
          console.error('Error creating account:', insertError);
          continue;
        }

        // Create AccountOwner entry
        const { error: ownerError } = await supabase
          .from('AccountOwner')
          .insert({
            accountId: accountId,
            ownerId: userId,
            createdAt: now,
            updatedAt: now,
          });

        if (ownerError) {
          console.error('Error creating account owner:', ownerError);
        }

        // PERFORMANCE: Create debt automatically for credit card accounts with pending balance
        // This ensures the debt is created immediately upon import, not waiting for liability sync
        if (accountType === 'credit' && currentBalance !== null && Math.abs(currentBalance) > 0) {
          try {
            const balanceAmount = Math.abs(currentBalance);
            const activeDebt = await getActiveCreditCardDebt(accountId);
            
            if (!activeDebt) {
              // Calculate next due date (use day 1 of next month as default if no due day specified)
              const nextDueDate = new Date();
              nextDueDate.setMonth(nextDueDate.getMonth() + 1);
              nextDueDate.setDate(1);
              
              await createDebt({
                name: `${plaidAccount.name} – Current Bill`,
                loanType: "credit_card",
                initialAmount: balanceAmount,
                downPayment: 0,
                interestRate: 0, // Will be updated when liabilities sync
                totalMonths: null,
                firstPaymentDate: formatDateOnly(nextDueDate),
                monthlyPayment: 0, // Credit cards have flexible payments - user can pay any amount (minimum, partial, full, or more)
                accountId: accountId,
                priority: "Medium",
                status: "active",
                nextDueDate: formatDateOnly(nextDueDate),
              });
              
              console.log(`[PLAID] Created debt for credit card account ${accountId} with balance ${balanceAmount}`);
            }
          } catch (error) {
            console.error('Error creating debt for credit card account:', error);
            // Don't fail account creation if debt creation fails
          }
        }

        createdAccounts.push(accountId);
      }
    }

    // Store or update PlaidConnection
    const { data: existingConnection } = await supabase
      .from('PlaidConnection')
      .select('id')
      .eq('itemId', itemId)
      .single();

    if (existingConnection) {
      // Update existing connection
      await supabase
        .from('PlaidConnection')
        .update({
          accessToken: accessToken,
          institutionId: institutionMetadata?.institution_id || null,
          institutionName: institutionMetadata?.name || null,
          updatedAt: now,
          errorCode: null,
          errorMessage: null,
        })
        .eq('id', existingConnection.id);
    } else {
      // Create new connection
      await supabase
        .from('PlaidConnection')
        .insert({
          id: crypto.randomUUID(),
          userId: userId,
          itemId: itemId,
          accessToken: accessToken,
          institutionId: institutionMetadata?.institution_id || null,
          institutionName: institutionMetadata?.name || null,
          createdAt: now,
          updatedAt: now,
        });
    }

    // Automatically sync transactions for all created accounts
    // Use hybrid processing: small imports (< 20 transactions) process immediately,
    // large imports (>= 20 transactions) create background jobs
    const syncResults = [];
    const importJobs = [];
    const TRANSACTION_THRESHOLD = 20;

    for (const accountId of createdAccounts) {
      try {
        // Get account details
        const { data: account } = await supabase
          .from('Account')
          .select('plaidAccountId, type')
          .eq('id', accountId)
          .single();

        if (account?.plaidAccountId) {
          // Only sync transactions for non-investment accounts
          // Investment accounts will be synced separately with holdings
          if (account.type !== 'investment') {
            // Estimate transaction count by making an initial sync call
            // We'll use the first page to estimate total count
            let estimatedTransactionCount = 0;
            try {
              const initialSync = await plaidClient.transactionsSync({
                access_token: accessToken,
                cursor: undefined,
              });
              
              const accountTransactions = (initialSync.data.added || []).filter(
                (tx: any) => tx.account_id === account.plaidAccountId
              );
              
              // Estimate: if has_more is true, there are likely many transactions
              // We'll use a conservative estimate based on first page
              if (initialSync.data.has_more) {
                // If there are more pages, estimate at least 20+ transactions
                estimatedTransactionCount = Math.max(accountTransactions.length, TRANSACTION_THRESHOLD);
              } else {
                estimatedTransactionCount = accountTransactions.length;
              }
            } catch (error) {
              console.error('Error estimating transaction count:', error);
              // If estimation fails, default to creating a job to be safe
              estimatedTransactionCount = TRANSACTION_THRESHOLD;
            }

            if (estimatedTransactionCount < TRANSACTION_THRESHOLD) {
              // Small import: process immediately
              const syncResult = await syncAccountTransactions(
                accountId,
                account.plaidAccountId,
                accessToken,
                30 // Sync last 30 days
              );
              syncResults.push({
                accountId,
                synced: syncResult.synced,
                skipped: syncResult.skipped,
                errors: syncResult.errors,
                processedImmediately: true,
              });
            } else {
              // Large import: create background job
              const jobId = crypto.randomUUID();
              const { error: jobError } = await supabase
                .from('ImportJob')
                .insert({
                  id: jobId,
                  userId: userId,
                  accountId: accountId,
                  type: 'plaid_sync',
                  status: 'pending',
                  totalItems: estimatedTransactionCount,
                  metadata: {
                    plaidAccountId: account.plaidAccountId,
                    itemId: itemId,
                    // NOTE: accessToken is NOT stored in metadata for security
                    // It will be fetched from PlaidConnection using itemId
                  },
                });

              if (!jobError) {
                importJobs.push(jobId);
                syncResults.push({
                  accountId,
                  synced: 0,
                  skipped: 0,
                  errors: 0,
                  jobId: jobId,
                  note: 'Large import queued for background processing',
                });
              } else {
                console.error('Error creating import job:', jobError);
                syncResults.push({
                  accountId,
                  synced: 0,
                  skipped: 0,
                  errors: 1,
                  error: 'Failed to create import job',
                });
              }
            }
          } else {
            // Investment accounts will be synced with holdings below
            syncResults.push({
              accountId,
              synced: 0,
              skipped: 0,
              errors: 0,
              note: 'Investment account - holdings will be synced separately',
            });
          }
        }
      } catch (error) {
        console.error(`Error syncing transactions for account ${accountId}:`, error);
        syncResults.push({
          accountId,
          synced: 0,
          skipped: 0,
          errors: 1,
        });
      }
    }

    // Sync liabilities for this item
    let liabilitySyncResult = null;
    try {
      liabilitySyncResult = await syncAccountLiabilities(itemId, accessToken);
    } catch (error) {
      console.error('Error syncing liabilities:', error);
      // Don't fail the whole request if liability sync fails
    }

    // Sync investment accounts, holdings, and transactions
    let investmentSyncResult = null;
    try {
      investmentSyncResult = await syncInvestmentAccounts(itemId, accessToken);
    } catch (error) {
      console.error('Error syncing investment accounts:', error);
      // Don't fail the whole request if investment sync fails
    }

    // Sync account balances to ensure they're updated in the database
    // Note: We already get real-time balances in exchangePublicToken using /accounts/balance/get,
    // but this call ensures all accounts have their balances properly synced after creation
    let balanceSyncResult = null;
    try {
      balanceSyncResult = await syncAccountBalances(itemId, accessToken);
      console.log('Balance sync result:', balanceSyncResult);
    } catch (error) {
      console.error('Error syncing account balances:', error);
      // Don't fail the whole request if balance sync fails
    }

    return NextResponse.json({
      success: true,
      itemId,
      accounts: createdAccounts,
      syncResults,
      importJobs, // Return job IDs for frontend progress tracking
      liabilitySync: liabilitySyncResult,
      investmentSync: investmentSyncResult,
      balanceSync: balanceSyncResult,
    });
  } catch (error: any) {
    console.error('Error exchanging public token:', error);

    // Check if it's a plan error
    if (error.planError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          planError: error.planError,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to exchange public token' },
      { status: 500 }
    );
  }
}

