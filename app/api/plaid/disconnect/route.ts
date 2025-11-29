import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { guardBankIntegration, getCurrentUserId } from '@/src/application/shared/feature-guard';
import { throwIfNotAllowed } from '@/src/application/shared/feature-guard';
import { formatTimestamp } from '@/lib/utils/timestamp';
import { plaidClient } from '@/lib/api/plaid';

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

    // Check if there are other accounts using the same plaidItemId
    const { data: otherAccounts } = await supabase
      .from('Account')
      .select('id')
      .eq('plaidItemId', account.plaidItemId)
      .neq('id', accountId)
      .eq('isConnected', true)
      .limit(1);

    const hasOtherConnectedAccounts = otherAccounts && otherAccounts.length > 0;

    // Get access token to remove item from Plaid
    // Only remove from Plaid if this is the last account using this itemId
    if (!hasOtherConnectedAccounts) {
      const { data: connection } = await supabase
        .from('PlaidConnection')
        .select('accessToken, itemId')
        .eq('itemId', account.plaidItemId)
        .single();

      // Remove item from Plaid if connection exists
      if (connection?.accessToken) {
        try {
          console.log('[PLAID] Removing item from Plaid:', account.plaidItemId);
          await plaidClient.itemRemove({
            access_token: connection.accessToken,
          });
          console.log('[PLAID] Successfully removed item from Plaid');
        } catch (error: any) {
          console.error('[PLAID] Error removing item from Plaid:', {
            error: error.message,
            error_code: error.response?.data?.error_code,
            error_type: error.response?.data?.error_type,
            itemId: account.plaidItemId,
          });
          // Continue with disconnection even if Plaid removal fails
          // The item might already be removed or the access token might be invalid
        }
      }
    } else {
      console.log('[PLAID] Skipping item removal - other accounts still use this connection');
    }

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

    // Clean up TransactionSync records for this account
    // This prevents issues if the account is reconnected later
    const { error: syncCleanupError } = await supabase
      .from('TransactionSync')
      .delete()
      .eq('accountId', accountId);

    if (syncCleanupError) {
      console.error('[PLAID] Error cleaning up TransactionSync:', syncCleanupError);
      // Continue anyway - the account is already disconnected
    } else {
      console.log('[PLAID] Cleaned up TransactionSync records for account:', accountId);
    }

    // Delete PlaidConnection if no other accounts use it
    // We already checked this above with hasOtherConnectedAccounts
    if (!hasOtherConnectedAccounts) {
      // No other accounts use this connection, delete it
      const { error: deleteError } = await supabase
        .from('PlaidConnection')
        .delete()
        .eq('itemId', account.plaidItemId);
      
      if (deleteError) {
        console.error('[PLAID] Error deleting PlaidConnection:', deleteError);
        // Continue anyway - the account is already disconnected
      } else {
        console.log('[PLAID] Deleted PlaidConnection for item:', account.plaidItemId);
      }
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

