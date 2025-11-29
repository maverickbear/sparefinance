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

    const supabase = await createServerClient();
    const now = formatTimestamp(new Date());

    // Get all PlaidConnection records for the user
    const { data: connections, error: connectionsError } = await supabase
      .from('PlaidConnection')
      .select('id, itemId, accessToken, institutionName')
      .eq('userId', userId);

    if (connectionsError) {
      console.error('Error fetching PlaidConnections:', connectionsError);
      return NextResponse.json(
        { error: 'Failed to fetch Plaid connections' },
        { status: 500 }
      );
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No Plaid connections found',
        connectionsRemoved: 0,
        accountsDisconnected: 0,
      });
    }

    let totalAccountsDisconnected = 0;
    const accountIdsToCleanup: string[] = [];

    // Process each connection
    for (const connection of connections) {
      // Find all accounts using this itemId
      const { data: accounts, error: accountsError } = await supabase
        .from('Account')
        .select('id, plaidItemId')
        .eq('plaidItemId', connection.itemId)
        .eq('isConnected', true);

      if (accountsError) {
        console.error(`Error fetching accounts for connection ${connection.id}:`, accountsError);
        continue;
      }

      if (accounts && accounts.length > 0) {
        // Disconnect all accounts
        const accountIds = accounts.map(acc => acc.id);
        accountIdsToCleanup.push(...accountIds);

        const { error: updateError } = await supabase
          .from('Account')
          .update({
            plaidItemId: null,
            plaidAccountId: null,
            isConnected: false,
            syncEnabled: false,
            updatedAt: now,
          })
          .in('id', accountIds);

        if (updateError) {
          console.error(`Error disconnecting accounts for connection ${connection.id}:`, updateError);
          // Continue with other connections even if this one fails
        } else {
          totalAccountsDisconnected += accountIds.length;
          console.log(`[PLAID] Disconnected ${accountIds.length} accounts for connection ${connection.id}`);
        }
      }

      // Remove item from Plaid
      if (connection.accessToken) {
        try {
          console.log('[PLAID] Removing item from Plaid:', connection.itemId);
          await plaidClient.itemRemove({
            access_token: connection.accessToken,
          });
          console.log('[PLAID] Successfully removed item from Plaid:', connection.itemId);
        } catch (error: any) {
          console.error('[PLAID] Error removing item from Plaid:', {
            error: error.message,
            error_code: error.response?.data?.error_code,
            error_type: error.response?.data?.error_type,
            itemId: connection.itemId,
            institutionName: connection.institutionName,
          });
          // Continue with disconnection even if Plaid removal fails
          // The item might already be removed or the access token might be invalid
        }
      }
    }

    // Clean up TransactionSync records for all disconnected accounts
    if (accountIdsToCleanup.length > 0) {
      const { error: syncCleanupError } = await supabase
        .from('TransactionSync')
        .delete()
        .in('accountId', accountIdsToCleanup);

      if (syncCleanupError) {
        console.error('[PLAID] Error cleaning up TransactionSync records:', syncCleanupError);
        // Continue anyway - accounts are already disconnected
      } else {
        console.log(`[PLAID] Cleaned up TransactionSync records for ${accountIdsToCleanup.length} accounts`);
      }
    }

    // Delete all PlaidConnection records for the user
    const { error: deleteError } = await supabase
      .from('PlaidConnection')
      .delete()
      .eq('userId', userId);

    if (deleteError) {
      console.error('[PLAID] Error deleting PlaidConnection records:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete Plaid connections' },
        { status: 500 }
      );
    }

    console.log(`[PLAID] Removed all Plaid integrations for user ${userId}: ${connections.length} connections, ${totalAccountsDisconnected} accounts`);

    return NextResponse.json({
      success: true,
      message: 'All Plaid connections removed successfully',
      connectionsRemoved: connections.length,
      accountsDisconnected: totalAccountsDisconnected,
    });
  } catch (error: any) {
    console.error('Error disconnecting all Plaid connections:', error);

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
      { error: 'Failed to disconnect all Plaid connections' },
      { status: 500 }
    );
  }
}

