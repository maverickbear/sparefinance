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

    // Parse request body
    const body = await req.json();
    const { publicToken, metadata } = body;

    if (!publicToken || !metadata) {
      return NextResponse.json(
        { error: 'Missing publicToken or metadata' },
        { status: 400 }
      );
    }

    // Exchange public token for access token and get accounts
    const { itemId, accessToken, accounts } = await exchangePublicToken(
      publicToken,
      metadata
    );

    const supabase = await createServerClient();
    const now = formatTimestamp(new Date());

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
      .select('id, itemId')
      .eq('itemId', itemId)
      .single();

    if (connectionCheckError || !connectionCheck) {
      console.error('PlaidConnection not found for itemId:', itemId);
      return NextResponse.json(
        { error: 'Plaid connection not found. Please try connecting again.' },
        { status: 400 }
      );
    }

    // Determine default currency - use USD as default, will be overridden by account balances if available
    // The currencyCode from account balances.iso_currency_code will be used when available
    const defaultCurrency = 'USD';

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
      // Use subtype when available for more precise mapping
      let accountType = 'checking';
      if (plaidAccount.type === 'depository') {
        // Use subtype to determine checking vs savings
        if (plaidAccount.subtype === 'savings' || plaidAccount.subtype === 'cd' || plaidAccount.subtype === 'money market') {
          accountType = 'savings';
        } else {
          // Default to checking for checking, paypal, prepaid, etc.
          accountType = 'checking';
        }
      } else if (plaidAccount.type === 'credit') {
        accountType = 'credit';
      } else if (plaidAccount.type === 'loan') {
        // Note: 'loan' is not in our Account type enum, so map to 'other'
        // The plaidSubtype will preserve the original loan subtype (mortgage, auto, student, etc.)
        accountType = 'other';
      } else if (plaidAccount.type === 'investment') {
        accountType = 'investment';
      } else {
        // For other types (brokerage, etc.), default to 'other'
        accountType = 'other';
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
          institutionId: metadata.institution?.institution_id || null,
          institutionName: metadata.institution?.name || null,
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
          institutionId: metadata.institution?.institution_id || null,
          institutionName: metadata.institution?.name || null,
          createdAt: now,
          updatedAt: now,
        });
    }

    // Automatically sync transactions for all created accounts
    const syncResults = [];
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
            });
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

