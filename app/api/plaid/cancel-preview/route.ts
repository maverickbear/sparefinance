import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/api/feature-guard';
import { createServerClient } from '@/lib/supabase-server';
import { plaidClient } from '@/lib/api/plaid/index';

/**
 * Cancel preview and clean up orphaned PlaidConnection
 * Called when user cancels the account mapping dialog
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing itemId' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get connection to verify ownership and get access token
    const { data: connection, error: connectionError } = await supabase
      .from('PlaidConnection')
      .select('id, itemId, accessToken, userId')
      .eq('itemId', itemId)
      .single();

    if (connectionError || !connection) {
      // Connection doesn't exist - nothing to clean up
      return NextResponse.json({
        success: true,
        message: 'No connection found to clean up',
      });
    }

    // Verify ownership
    if (connection.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if any accounts were created for this connection
    const { data: accounts } = await supabase
      .from('Account')
      .select('id')
      .eq('plaidItemId', itemId)
      .limit(1);

    // If accounts exist, don't remove the connection
    if (accounts && accounts.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Connection has accounts - not cleaning up',
      });
    }

    // Remove item from Plaid
    if (connection.accessToken) {
      try {
        console.log('[PLAID CANCEL] Removing item from Plaid:', itemId);
        await plaidClient.itemRemove({
          access_token: connection.accessToken,
        });
        console.log('[PLAID CANCEL] Successfully removed item from Plaid');
      } catch (error: any) {
        console.warn('[PLAID CANCEL] Error removing item from Plaid (continuing anyway):', {
          error: error.message,
          error_code: error.response?.data?.error_code,
        });
        // Continue with cleanup even if Plaid removal fails
      }
    }

    // Delete the orphaned connection
    const { error: deleteError } = await supabase
      .from('PlaidConnection')
      .delete()
      .eq('id', connection.id);

    if (deleteError) {
      console.error('[PLAID CANCEL] Error deleting connection:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clean up connection' },
        { status: 500 }
      );
    }

    console.log('[PLAID CANCEL] Successfully cleaned up orphaned connection:', itemId);

    return NextResponse.json({
      success: true,
      message: 'Preview cancelled and connection cleaned up',
    });
  } catch (error: any) {
    console.error('[PLAID CANCEL] Error cancelling preview:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel preview' },
      { status: 500 }
    );
  }
}

