import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
// import { exchangePublicToken } from '@/lib/api/plaid/connect'; // TEMPORARILY DISABLED
// import { syncAccountTransactions } from '@/lib/api/plaid/sync'; // TEMPORARILY DISABLED
// import { syncAccountLiabilities } from '@/lib/api/plaid/liabilities'; // TEMPORARILY DISABLED
import { guardBankIntegration, getCurrentUserId } from '@/lib/api/feature-guard';
import { throwIfNotAllowed } from '@/lib/api/feature-guard';
import { formatTimestamp } from '@/lib/utils/timestamp';

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

    // TEMPORARY BYPASS: Return mock data instead of calling Plaid
    console.log('[PLAID BYPASS] Exchanging public token (bypassed)');
    const mockItemId = `item-bypass-${Date.now()}`;
    const mockAccessToken = `access-bypass-${Date.now()}`;
    const mockAccounts = [
      {
        account_id: `acc-bypass-${Date.now()}`,
        name: metadata.institution?.name || 'Mock Bank Account',
        type: 'depository',
        subtype: 'checking',
        balances: {
          available: 1000,
          current: 1000,
        },
        mask: '0000',
        official_name: metadata.institution?.name || 'Mock Bank Account',
        verification_status: 'automatically_verified',
      },
    ];

    // Original implementation (commented out):
    // const { itemId, accessToken, accounts } = await exchangePublicToken(
    //   publicToken,
    //   metadata
    // );
    
    const itemId = mockItemId;
    const accessToken = mockAccessToken;
    const accounts = mockAccounts;

    const supabase = await createServerClient();
    const now = formatTimestamp(new Date());

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
      let accountType = 'checking';
      if (plaidAccount.type === 'depository') {
        if (plaidAccount.subtype === 'savings') {
          accountType = 'savings';
        } else {
          accountType = 'checking';
        }
      } else if (plaidAccount.type === 'credit') {
        accountType = 'credit';
      } else if (plaidAccount.type === 'loan') {
        accountType = 'loan';
      }

      if (existingAccount) {
        // Update existing account
        const { error: updateError } = await supabase
          .from('Account')
          .update({
            plaidItemId: itemId,
            plaidAccountId: plaidAccount.account_id,
            isConnected: true,
            syncEnabled: true,
            plaidMask: (plaidAccount as any).mask || null,
            plaidOfficialName: (plaidAccount as any).official_name || null,
            plaidVerificationStatus: (plaidAccount as any).verification_status || null,
            updatedAt: now,
          })
          .eq('id', existingAccount.id);

        if (updateError) {
          console.error('Error updating account:', updateError);
          continue;
        }

        createdAccounts.push(existingAccount.id);
      } else {
        // Create new account
        const accountId = crypto.randomUUID();
        const initialBalance = plaidAccount.balances.current || 0;

        const { error: insertError } = await supabase
          .from('Account')
          .insert({
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
            userId: userId,
            createdAt: now,
            updatedAt: now,
          });

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

    // TEMPORARY BYPASS: Skip transaction and liability sync
    console.log('[PLAID BYPASS] Skipping transaction and liability sync');
    const syncResults = createdAccounts.map((accountId) => ({
      accountId,
      synced: 0,
      skipped: 0,
      errors: 0,
    }));

    // Original implementation (commented out):
    // // Automatically sync transactions for all created accounts
    // const syncResults = [];
    // for (const accountId of createdAccounts) {
    //   try {
    //     // Get account details
    //     const { data: account } = await supabase
    //       .from('Account')
    //       .select('plaidAccountId')
    //       .eq('id', accountId)
    //       .single();

    //     if (account?.plaidAccountId) {
    //       const syncResult = await syncAccountTransactions(
    //         accountId,
    //         account.plaidAccountId,
    //         accessToken,
    //         30 // Sync last 30 days
    //       );
    //       syncResults.push({
    //         accountId,
    //         synced: syncResult.synced,
    //         skipped: syncResult.skipped,
    //         errors: syncResult.errors,
    //       });
    //     }
    //   } catch (error) {
    //     console.error(`Error syncing transactions for account ${accountId}:`, error);
    //     syncResults.push({
    //       accountId,
    //       synced: 0,
    //       skipped: 0,
    //       errors: 1,
    //     });
    //   }
    // }

    // // Sync liabilities for this item
    // let liabilitySyncResult = null;
    // try {
    //   liabilitySyncResult = await syncAccountLiabilities(itemId, accessToken);
    // } catch (error) {
    //   console.error('Error syncing liabilities:', error);
    //   // Don't fail the whole request if liability sync fails
    // }
    
    const liabilitySyncResult = null;

    return NextResponse.json({
      success: true,
      itemId,
      accounts: createdAccounts,
      syncResults,
      liabilitySync: liabilitySyncResult,
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

