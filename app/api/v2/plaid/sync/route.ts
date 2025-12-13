import { NextRequest, NextResponse } from 'next/server';
import { makePlaidService } from '@/src/application/plaid/plaid.factory';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { AppError } from '@/src/application/shared/app-error';
import { z } from 'zod';

/**
 * Check if Plaid is enabled
 */
function isPlaidEnabled(): boolean {
  return process.env.PLAID_ENABLED !== 'false';
}

const syncRequestSchema = z.object({
  itemId: z.string().optional(),
  accountId: z.string().optional(),
}).refine(data => data.itemId || data.accountId, {
  message: 'Either itemId or accountId must be provided',
});

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

    const body = await request.json();

    // Validate request
    let validatedData;
    try {
      validatedData = syncRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    const service = makePlaidService();

    if (validatedData.itemId) {
      // Sync entire item
      const result = await service.syncItem(validatedData.itemId);
      return NextResponse.json(result, { status: 200 });
    } else if (validatedData.accountId) {
      // Sync single account
      const result = await service.syncAccount(validatedData.accountId);
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(
        { error: 'Either itemId or accountId must be provided' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Plaid API] Error syncing:', error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync' },
      { status: 500 }
    );
  }
}
