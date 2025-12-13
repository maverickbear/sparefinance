/**
 * GET /api/cron/retry-failed-plaid-syncs
 * Cron job to retry failed Plaid syncs with exponential backoff
 * Runs periodically to retry items that failed to sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/src/infrastructure/database/supabase-server';
import { PlaidItemsRepository } from '@/src/infrastructure/database/repositories/plaid-items.repository';
import { makePlaidService } from '@/src/application/plaid/plaid.factory';
import { logger } from '@/lib/utils/logger';

/**
 * Check if Plaid is enabled
 */
function isPlaidEnabled(): boolean {
  return process.env.PLAID_ENABLED !== 'false';
}

/**
 * Maximum retry attempts
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay for retries (in milliseconds)
 */
const RETRY_DELAY_BASE_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Security: Check for cron authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const vercelCron = request.headers.get('x-vercel-cron');

    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isVercelCron = !!vercelCron;

    if (!isCronAuth && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature flag
    if (!isPlaidEnabled()) {
      logger.info('[Plaid Retry Cron] Plaid integration is disabled, skipping');
      return NextResponse.json({ message: 'Plaid integration is disabled' }, { status: 200 });
    }

    logger.info('[Plaid Retry Cron] Starting retry of failed Plaid syncs');

    const supabase = createServiceRoleClient();
    const plaidItemsRepository = new PlaidItemsRepository();
    const plaidService = makePlaidService();

    // Find items that failed to sync and need retry
    // Criteria:
    // 1. Status is 'error' (not 'item_login_required' - that needs user action)
    // 2. Last successful update was more than 1 hour ago (or never)
    // 3. Not currently syncing
    // 4. Error is retryable (not authentication errors)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: failedItems, error: fetchError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('status', 'error')
      .eq('is_syncing', false)
      .not('error_code', 'eq', 'ITEM_LOGIN_REQUIRED')
      .not('error_code', 'eq', 'USER_PERMISSION_REVOKED')
      .or(`last_successful_update.is.null,last_successful_update.lt.${oneHourAgo}`)
      .limit(50); // Process max 50 items per run

    if (fetchError) {
      logger.error('[Plaid Retry Cron] Error fetching failed items:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch failed items' },
        { status: 500 }
      );
    }

    if (!failedItems || failedItems.length === 0) {
      logger.info('[Plaid Retry Cron] No failed items to retry');
      return NextResponse.json({
        message: 'No failed items to retry',
        retried: 0,
      });
    }

    logger.info('[Plaid Retry Cron] Found failed items to retry', {
      count: failedItems.length,
    });

    const results = {
      retried: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };

    // Retry each failed item
    for (const item of failedItems) {
      try {
        // Check if we should retry based on error code
        const errorCode = item.error_code;
        if (
          errorCode === 'ITEM_LOGIN_REQUIRED' ||
          errorCode === 'USER_PERMISSION_REVOKED' ||
          errorCode === 'INVALID_ACCESS_TOKEN'
        ) {
          // These errors require user action, don't retry
          results.skipped++;
          continue;
        }

        // Check retry count (we'll use a simple approach - retry if last update was > 1 hour ago)
        const lastUpdate = item.last_successful_update
          ? new Date(item.last_successful_update)
          : null;

        if (lastUpdate) {
          const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
          // Only retry if it's been at least 1 hour since last successful update
          if (hoursSinceUpdate < 1) {
            results.skipped++;
            continue;
          }
        }

        logger.info('[Plaid Retry Cron] Retrying sync for item', {
          itemId: item.item_id,
          errorCode: item.error_code,
        });

        // Attempt to sync the item
        await plaidService.syncItemForWebhook(item.item_id);

        results.retried++;
        results.succeeded++;

        logger.info('[Plaid Retry Cron] Successfully retried sync for item', {
          itemId: item.item_id,
        });
      } catch (error: any) {
        results.retried++;
        results.failed++;

        logger.error('[Plaid Retry Cron] Error retrying sync for item', {
          itemId: item.item_id,
          error: error?.message || 'Unknown error',
        });

        // Update error status if sync failed again
        if (error?.response?.data?.error_code) {
          await plaidItemsRepository.update(item.item_id, {
            status: 'error',
            errorCode: error.response.data.error_code,
            errorMessage: error.response.data.error_message || error.message,
          });
        }
      }
    }

    logger.info('[Plaid Retry Cron] Completed retry run', results);

    return NextResponse.json({
      message: 'Retry completed',
      ...results,
    });
  } catch (error) {
    logger.error('[Plaid Retry Cron] Error in retry cron:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry failed syncs' },
      { status: 500 }
    );
  }
}
