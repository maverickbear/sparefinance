import { NextRequest, NextResponse } from 'next/server';
import { makePlaidService } from '@/src/application/plaid/plaid.factory';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { AppError } from '@/src/application/shared/app-error';

/**
 * Check if Plaid is enabled
 */
function isPlaidEnabled(): boolean {
  return process.env.PLAID_ENABLED !== 'false';
}

export async function POST(request: NextRequest) {
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

    const service = makePlaidService();
    const response = await service.createLinkToken(userId);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Plaid API] Error creating link token:', error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create link token' },
      { status: 500 }
    );
  }
}
