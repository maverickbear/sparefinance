import { NextRequest, NextResponse } from 'next/server';
import { deduplicateTransactions } from '@/lib/api/plaid/deduplicate-transactions';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';

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

    // Parse request body for optional accountId
    const body = await req.json().catch(() => ({}));
    const accountId = body.accountId || undefined;

    // Run deduplication
    const result = await deduplicateTransactions(accountId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error deduplicating transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to deduplicate transactions' },
      { status: 500 }
    );
  }
}

