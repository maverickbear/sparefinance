/**
 * GET /api/v2/plaid/accounts/[accountId]/status
 * Get Plaid item status for an account
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { AppError } from '@/src/application/shared/app-error';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { PlaidItemsRepository } from '@/src/infrastructure/database/repositories/plaid-items.repository';
import { logger } from '@/lib/utils/logger';

/**
 * Check if Plaid is enabled
 */
function isPlaidEnabled(): boolean {
  return process.env.PLAID_ENABLED !== 'false';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    // Check feature flag
    if (!isPlaidEnabled()) {
      return NextResponse.json(
        { error: 'Plaid integration is currently disabled' },
        { status: 503 }
      );
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId } = await params;

    // Get account integration to find plaid_item_id
    const supabase = await createServerClient();
    const { data: integration, error: integrationError } = await supabase
      .from('account_integrations')
      .select('plaid_item_id, is_connected, sync_enabled, last_synced_at')
      .eq('account_id', accountId)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Account is not connected to Plaid' },
        { status: 404 }
      );
    }

    if (!integration.plaid_item_id) {
      return NextResponse.json(
        { error: 'Account is not connected to Plaid' },
        { status: 404 }
      );
    }

    // Get Plaid item status
    const plaidItemsRepository = new PlaidItemsRepository();
    const item = await plaidItemsRepository.findByItemId(integration.plaid_item_id);

    if (!item) {
      return NextResponse.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (item.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      itemId: item.item_id,
      status: item.status,
      errorCode: item.error_code,
      errorMessage: item.error_message,
      isSyncing: item.is_syncing,
      syncStartedAt: item.sync_started_at,
      lastSuccessfulUpdate: item.last_successful_update,
      lastSyncedAt: integration.last_synced_at,
      isConnected: integration.is_connected,
      syncEnabled: integration.sync_enabled,
      institutionName: item.institution_name,
      institutionId: item.institution_id,
    });
  } catch (error) {
    logger.error('[Plaid Status API] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get Plaid status' },
      { status: 500 }
    );
  }
}
