import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
// import { syncAccountLiabilities } from '@/lib/api/plaid/liabilities'; // TEMPORARILY DISABLED
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

    // Parse request body
    const body = await req.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing itemId' },
        { status: 400 }
      );
    }

    // TEMPORARY BYPASS: Return mock result instead of calling Plaid
    console.log('[PLAID BYPASS] Syncing liabilities (bypassed) for item:', itemId);
    
    // Original implementation (commented out):
    // const supabase = await createServerClient();

    // // Get access token for this item
    // const { data: connection } = await supabase
    //   .from('PlaidConnection')
    //   .select('accessToken')
    //   .eq('itemId', itemId)
    //   .single();

    // if (!connection?.accessToken) {
    //   return NextResponse.json(
    //     { error: 'Plaid connection not found' },
    //     { status: 404 }
    //   );
    // }

    // // Sync liabilities
    // const result = await syncAccountLiabilities(itemId, connection.accessToken);

    const result = {
      synced: 0,
      skipped: 0,
      errors: 0,
    };

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error syncing liabilities:', error);

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
      { error: 'Failed to sync liabilities' },
      { status: 500 }
    );
  }
}

