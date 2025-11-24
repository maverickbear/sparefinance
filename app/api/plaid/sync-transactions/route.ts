import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { syncAccountTransactions } from '@/lib/api/plaid/sync';
import { guardBankIntegration, getCurrentUserId } from '@/lib/api/feature-guard';
import { throwIfNotAllowed } from '@/lib/api/feature-guard';

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

    // Parse request body
    const body = await req.json();
    const { accountId, daysBack } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing accountId' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get account and verify ownership
    const { data: account, error: accountError } = await supabase
      .from('Account')
      .select('id, plaidAccountId, plaidItemId, userId')
      .eq('id', accountId)
      .eq('userId', userId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (!account.plaidAccountId || !account.plaidItemId) {
      return NextResponse.json(
        { error: 'Account is not connected to Plaid' },
        { status: 400 }
      );
    }

    // Get access token
    const { data: connection, error: connectionError } = await supabase
      .from('PlaidConnection')
      .select('accessToken')
      .eq('itemId', account.plaidItemId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Plaid connection not found' },
        { status: 404 }
      );
    }

    // Sync transactions
    const result = await syncAccountTransactions(
      accountId,
      account.plaidAccountId,
      connection.accessToken,
      daysBack || 30
    );

    return NextResponse.json({
      success: true,
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('Error syncing transactions:', error);
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

