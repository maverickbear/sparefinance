import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { guardBankIntegration, getCurrentUserId } from '@/lib/api/feature-guard';
import { throwIfNotAllowed } from '@/lib/api/feature-guard';
import { formatTimestamp } from '@/lib/utils/timestamp';
// import { plaidClient } from '@/lib/api/plaid'; // TEMPORARILY DISABLED

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
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing accountId' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get account and verify ownership
    const { data: account, error: accountError } = await supabase
      .from('Account')
      .select('id, plaidItemId, userId')
      .eq('id', accountId)
      .eq('userId', userId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (!account.plaidItemId) {
      return NextResponse.json(
        { error: 'Account is not connected to Plaid' },
        { status: 400 }
      );
    }

    // TEMPORARY BYPASS: Skip Plaid API call
    console.log('[PLAID BYPASS] Disconnecting account (bypassed) for account:', accountId);
    
    // Original implementation (commented out):
    // // Get access token to remove item from Plaid
    // const { data: connection } = await supabase
    //   .from('PlaidConnection')
    //   .select('accessToken, itemId')
    //   .eq('itemId', account.plaidItemId)
    //   .single();

    // // Remove item from Plaid if connection exists
    // if (connection?.accessToken) {
    //   try {
    //     await plaidClient.itemRemove({
    //       access_token: connection.accessToken,
    //     });
    //   } catch (error) {
    //     console.error('Error removing item from Plaid:', error);
    //     // Continue with disconnection even if Plaid removal fails
    //   }
    // }

    const now = formatTimestamp(new Date());

    // Disconnect account
    const { error: updateError } = await supabase
      .from('Account')
      .update({
        plaidItemId: null,
        plaidAccountId: null,
        isConnected: false,
        syncEnabled: false,
        updatedAt: now,
      })
      .eq('id', accountId);

    if (updateError) {
      console.error('Error disconnecting account:', updateError);
      return NextResponse.json(
        { error: 'Failed to disconnect account' },
        { status: 500 }
      );
    }

    // Delete PlaidConnection if no other accounts use it
    const { data: otherAccounts } = await supabase
      .from('Account')
      .select('id')
      .eq('plaidItemId', account.plaidItemId)
      .neq('id', accountId)
      .limit(1);

    if (!otherAccounts || otherAccounts.length === 0) {
      // No other accounts use this connection, delete it
      await supabase
        .from('PlaidConnection')
        .delete()
        .eq('itemId', account.plaidItemId);
    }

    return NextResponse.json({
      success: true,
      message: 'Account disconnected successfully',
    });
  } catch (error: any) {
    console.error('Error disconnecting account:', error);

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
      { error: 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}

