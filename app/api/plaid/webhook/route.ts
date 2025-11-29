import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { syncAccountTransactions } from '@/lib/api/plaid/sync';
import { syncAccountLiabilities } from '@/lib/api/plaid/liabilities';
import { syncInvestmentAccounts } from '@/lib/api/plaid/investments';
import { syncAccountBalances } from '@/lib/api/plaid/connect';

/**
 * Plaid Webhook Handler
 * 
 * Receives webhooks from Plaid for:
 * - TRANSACTIONS: New transactions available
 * - ITEM: Item status changes (errors, updates, etc.)
 * - INVESTMENTS_TRANSACTIONS: New investment transactions
 * - LIABILITIES: Liability updates
 * 
 * Documentation: https://plaid.com/docs/api/webhooks/
 * 
 * Configured webhook URL: https://sparefinance.com/api/plaid/webhook
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('[PLAID WEBHOOK] Received webhook:', {
      webhook_type: body.webhook_type,
      webhook_code: body.webhook_code,
      item_id: body.item_id,
    });

    const { webhook_type, webhook_code, item_id } = body;

    if (!item_id) {
      console.error('[PLAID WEBHOOK] Missing item_id in webhook');
      return NextResponse.json(
        { error: 'Missing item_id' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get Plaid connection for this item
    const { data: connection, error: connectionError } = await supabase
      .from('PlaidConnection')
      .select('id, userId, accessToken, itemId')
      .eq('itemId', item_id)
      .single();

    if (connectionError || !connection) {
      console.error('[PLAID WEBHOOK] Connection not found for item:', item_id);
      // Return 200 to prevent retries for invalid items
      return NextResponse.json({ received: true });
    }

    // Handle different webhook types
    switch (webhook_type) {
      case 'TRANSACTIONS': {
        await handleTransactionsWebhook(supabase, webhook_code, item_id, connection, body);
        break;
      }

      case 'ITEM': {
        await handleItemWebhook(supabase, webhook_code, item_id, connection, body);
        break;
      }

      case 'INVESTMENTS_TRANSACTIONS': {
        await handleInvestmentsTransactionsWebhook(supabase, item_id, connection);
        break;
      }

      case 'LIABILITIES': {
        await handleLiabilitiesWebhook(supabase, item_id, connection);
        break;
      }

      default: {
        console.log('[PLAID WEBHOOK] Unhandled webhook type:', webhook_type);
      }
    }

    // Always return 200 to acknowledge receipt
    // Plaid will retry if we return non-200
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[PLAID WEBHOOK] Error processing webhook:', error);
    // Return 200 to prevent retries on errors we can't handle
    return NextResponse.json({ received: true });
  }
}

/**
 * Handle TRANSACTIONS webhooks
 */
async function handleTransactionsWebhook(
  supabase: any,
  webhook_code: string,
  item_id: string,
  connection: any,
  body?: any
) {
  console.log('[PLAID WEBHOOK] Processing TRANSACTIONS webhook:', webhook_code);

  switch (webhook_code) {
    case 'SYNC_UPDATES_AVAILABLE': {
      // Recommended webhook for /transactions/sync endpoint
      // This webhook fires when new transaction updates are available
      console.log('[PLAID WEBHOOK] Sync updates available, syncing...');
      
      const { initial_update_complete, historical_update_complete } = body || {};
      
      // Get all accounts for this item
      const { data: accounts } = await supabase
        .from('Account')
        .select('id, plaidAccountId, type')
        .eq('plaidItemId', item_id)
        .eq('isConnected', true)
        .eq('syncEnabled', true);

      if (!accounts || accounts.length === 0) {
        console.log('[PLAID WEBHOOK] No connected accounts found for item');
        return;
      }

      // Sync transactions for each account (except investment accounts)
      for (const account of accounts) {
        if (account.plaidAccountId && account.type !== 'investment') {
          try {
            // Use /transactions/sync which handles cursor automatically
            // The daysBack parameter is ignored when using /transactions/sync
            await syncAccountTransactions(
              account.id,
              account.plaidAccountId,
              connection.accessToken,
              0 // Not used with /transactions/sync, but kept for compatibility
            );
            console.log(`[PLAID WEBHOOK] Synced transactions for account ${account.id}`, {
              initial_update_complete,
              historical_update_complete,
            });
          } catch (error) {
            console.error(`[PLAID WEBHOOK] Error syncing transactions for account ${account.id}:`, error);
          }
        }
      }

      // Sync account balances after syncing transactions
      // This ensures we have the latest balance from Plaid
      try {
        const balanceResult = await syncAccountBalances(item_id, connection.accessToken);
        console.log(`[PLAID WEBHOOK] Synced balances for item ${item_id}:`, balanceResult);
      } catch (error) {
        console.error(`[PLAID WEBHOOK] Error syncing balances for item ${item_id}:`, error);
        // Don't fail the webhook if balance sync fails
      }
      break;
    }

    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE': {
      // Legacy webhooks for /transactions/get (still supported for backwards compatibility)
      // For /transactions/sync, prefer SYNC_UPDATES_AVAILABLE
      console.log('[PLAID WEBHOOK] Legacy webhook received, syncing...');
      
      // Get all accounts for this item
      const { data: accounts } = await supabase
        .from('Account')
        .select('id, plaidAccountId, type')
        .eq('plaidItemId', item_id)
        .eq('isConnected', true)
        .eq('syncEnabled', true);

      if (!accounts || accounts.length === 0) {
        console.log('[PLAID WEBHOOK] No connected accounts found for item');
        return;
      }

      // Sync transactions for each account (except investment accounts)
      for (const account of accounts) {
        if (account.plaidAccountId && account.type !== 'investment') {
          try {
            await syncAccountTransactions(
              account.id,
              account.plaidAccountId,
              connection.accessToken,
              0 // Not used with /transactions/sync
            );
            console.log(`[PLAID WEBHOOK] Synced transactions for account ${account.id}`);
          } catch (error) {
            console.error(`[PLAID WEBHOOK] Error syncing transactions for account ${account.id}:`, error);
          }
        }
      }

      // Sync account balances after syncing transactions
      try {
        const balanceResult = await syncAccountBalances(item_id, connection.accessToken);
        console.log(`[PLAID WEBHOOK] Synced balances for item ${item_id}:`, balanceResult);
      } catch (error) {
        console.error(`[PLAID WEBHOOK] Error syncing balances for item ${item_id}:`, error);
        // Don't fail the webhook if balance sync fails
      }
      break;
    }

    case 'TRANSACTIONS_REMOVED': {
      // Legacy webhook for /transactions/get
      // With /transactions/sync, removed transactions are included in the sync response
      // This webhook is still fired for backwards compatibility
      console.log('[PLAID WEBHOOK] Transactions removed webhook received');
      console.log('[PLAID WEBHOOK] Note: With /transactions/sync, removed transactions are handled automatically during sync');
      
      // We can optionally trigger a sync to process removals, but it's not necessary
      // as they'll be handled in the next SYNC_UPDATES_AVAILABLE webhook
      break;
    }

    default: {
      console.log('[PLAID WEBHOOK] Unhandled TRANSACTIONS webhook code:', webhook_code);
    }
  }
}

/**
 * Handle ITEM webhooks (Item status changes)
 */
async function handleItemWebhook(
  supabase: any,
  webhook_code: string,
  item_id: string,
  connection: any,
  body: any
) {
  console.log('[PLAID WEBHOOK] Processing ITEM webhook:', webhook_code);

  const now = new Date().toISOString();

  switch (webhook_code) {
    case 'ERROR': {
      // Item is in an error state
      const error = body.error || {};
      const errorCode = error.error_code;
      const errorType = error.error_type;
      
      console.error('[PLAID WEBHOOK] Item error:', {
        error_code: errorCode,
        error_type: errorType,
        error_message: error.error_message,
        display_message: error.display_message,
        item_id,
        institution_id: connection.institutionId,
        institution_name: connection.institutionName,
      });

      await supabase
        .from('PlaidConnection')
        .update({
          errorCode: errorCode || null,
          errorMessage: error.error_message || null,
          updatedAt: now,
        })
        .eq('id', connection.id);

      // For INTERNAL_SERVER_ERROR, it's often temporary - log but don't necessarily disable sync
      // For other errors, disable sync to prevent repeated failed attempts
      if (errorCode !== 'INTERNAL_SERVER_ERROR' && errorType !== 'API_ERROR') {
        await supabase
          .from('Account')
          .update({
            syncEnabled: false,
            updatedAt: now,
          })
          .eq('plaidItemId', item_id);
      } else {
        // For INTERNAL_SERVER_ERROR, log but keep sync enabled (it may recover)
        console.warn('[PLAID WEBHOOK] INTERNAL_SERVER_ERROR detected - keeping sync enabled as this is often temporary');
      }

      break;
    }

    case 'PENDING_EXPIRATION': {
      // Access token will expire soon - user needs to reconnect
      console.log('[PLAID WEBHOOK] Access token expiring soon for item:', item_id);
      
      await supabase
        .from('PlaidConnection')
        .update({
          errorCode: 'PENDING_EXPIRATION',
          errorMessage: 'Access token will expire soon. Please reconnect your account.',
          updatedAt: now,
        })
        .eq('id', connection.id);

      break;
    }

    case 'USER_PERMISSION_REVOKED': {
      // User revoked access
      console.log('[PLAID WEBHOOK] User revoked access for item:', item_id);
      
      await supabase
        .from('PlaidConnection')
        .update({
          errorCode: 'USER_PERMISSION_REVOKED',
          errorMessage: 'User revoked access to this account.',
          updatedAt: now,
        })
        .eq('id', connection.id);

      // Disconnect accounts
      await supabase
        .from('Account')
        .update({
          isConnected: false,
          syncEnabled: false,
          updatedAt: now,
        })
        .eq('plaidItemId', item_id);

      break;
    }

    case 'WEBHOOK_UPDATE_ACKNOWLEDGED': {
      // Webhook URL was updated
      console.log('[PLAID WEBHOOK] Webhook URL update acknowledged');
      break;
    }

    default: {
      console.log('[PLAID WEBHOOK] Unhandled ITEM webhook code:', webhook_code);
    }
  }
}

/**
 * Handle INVESTMENTS_TRANSACTIONS webhooks
 */
async function handleInvestmentsTransactionsWebhook(
  supabase: any,
  item_id: string,
  connection: any
) {
  console.log('[PLAID WEBHOOK] Processing INVESTMENTS_TRANSACTIONS webhook');

  try {
    await syncInvestmentAccounts(item_id, connection.accessToken);
    console.log('[PLAID WEBHOOK] Synced investment transactions');
  } catch (error) {
    console.error('[PLAID WEBHOOK] Error syncing investment transactions:', error);
  }
}

/**
 * Handle LIABILITIES webhooks
 */
async function handleLiabilitiesWebhook(
  supabase: any,
  item_id: string,
  connection: any
) {
  console.log('[PLAID WEBHOOK] Processing LIABILITIES webhook');

  try {
    await syncAccountLiabilities(item_id, connection.accessToken);
    console.log('[PLAID WEBHOOK] Synced liabilities');
  } catch (error) {
    console.error('[PLAID WEBHOOK] Error syncing liabilities:', error);
  }
}

