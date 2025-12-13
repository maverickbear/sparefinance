/**
 * GET /api/v2/plaid/connections
 * Get all Plaid connections for the current user
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

export async function GET(request: NextRequest) {
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

    const plaidItemsRepository = new PlaidItemsRepository();
    const items = await plaidItemsRepository.findByUserId(userId);

    const supabase = await createServerClient();

    // Get account counts for each item
    const connections = await Promise.all(
      items.map(async (item) => {
        // Count accounts for this item
        const { count } = await supabase
          .from('account_integrations')
          .select('*', { count: 'exact', head: true })
          .eq('plaid_item_id', item.id)
          .eq('is_connected', true);

        // Get first account ID for reconnect button
        const { data: firstAccount } = await supabase
          .from('account_integrations')
          .select('account_id')
          .eq('plaid_item_id', item.id)
          .eq('is_connected', true)
          .limit(1)
          .single();

        return {
          itemId: item.item_id,
          institutionName: item.institution_name,
          status: item.status,
          errorCode: item.error_code,
          errorMessage: item.error_message,
          isSyncing: item.is_syncing,
          lastSuccessfulUpdate: item.last_successful_update,
          accountCount: count || 0,
          accountId: firstAccount?.account_id || undefined,
        };
      })
    );

    return NextResponse.json({
      connections,
    });
  } catch (error) {
    logger.error('[Plaid Connections API] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get Plaid connections' },
      { status: 500 }
    );
  }
}
