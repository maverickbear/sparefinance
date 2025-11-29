import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { syncAllUserAccounts } from '@/lib/api/plaid/sync';
import { guardBankIntegration, getCurrentUserId } from '@/src/application/shared/feature-guard';
import { throwIfNotAllowed } from '@/src/application/shared/feature-guard';

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

    // Check if user has access to bank integration
    const guardResult = await guardBankIntegration(userId);
    await throwIfNotAllowed(guardResult);

    // Sync all connected accounts
    const result = await syncAllUserAccounts(userId);

    return NextResponse.json({
      success: true,
      accounts: result.accounts,
      synced: result.totalSynced,
      skipped: result.totalSkipped,
      errors: result.totalErrors,
    });
  } catch (error: any) {
    console.error('Error syncing all accounts:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    });

    // Check if it's a plan error
    if (error.planError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          planError: error.planError,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { 
        error: error.message || 'Failed to sync transactions',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

