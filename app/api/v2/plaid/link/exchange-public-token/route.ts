import { NextRequest, NextResponse } from 'next/server';
import { makePlaidService } from '@/src/application/plaid/plaid.factory';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { AppError } from '@/src/application/shared/app-error';
import { exchangePublicTokenRequestSchema } from '@/src/domain/plaid/plaid.validations';
import { ZodError } from 'zod';

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

    const body = await request.json();

    // Validate request
    let validatedData;
    try {
      validatedData = exchangePublicTokenRequestSchema.parse({
        ...body,
        userId,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Invalid request', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    const service = makePlaidService();
    const response = await service.exchangePublicToken(
      validatedData.publicToken,
      userId
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Plaid API] Error exchanging public token:', error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exchange public token' },
      { status: 500 }
    );
  }
}
