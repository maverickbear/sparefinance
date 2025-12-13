/**
 * DELETE /api/v2/plaid/items/[itemId]/disconnect
 * Disconnect a Plaid item
 * Phase D: Disconnect endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { makePlaidService } from '@/src/application/plaid/plaid.factory';
import { AppError } from '@/src/application/shared/app-error';
import { logger } from '@/lib/utils/logger';

/**
 * Check if Plaid is enabled
 */
function isPlaidEnabled(): boolean {
  return process.env.PLAID_ENABLED !== 'false';
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    // Check feature flag
    if (!isPlaidEnabled()) {
      return NextResponse.json(
        { error: 'Plaid integration is currently disabled' },
        { status: 503 }
      );
    }

    const { itemId } = await params;

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId is required' },
        { status: 400 }
      );
    }

    logger.info('[Plaid Disconnect] Disconnecting item', { itemId });

    const service = makePlaidService();
    await service.disconnectItem(itemId);

    logger.info('[Plaid Disconnect] Item disconnected successfully', { itemId });

    return NextResponse.json(
      { success: true, message: 'Item disconnected successfully' },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[Plaid Disconnect] Error disconnecting item:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect item' },
      { status: 500 }
    );
  }
}
