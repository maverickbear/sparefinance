import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { cleanupAllPlaidData } from '@/lib/api/plaid/cleanup';

/**
 * API endpoint to clean up orphaned Plaid data
 * 
 * This endpoint can be called:
 * 1. Manually by admins
 * 2. By a scheduled job/cron
 * 3. After account disconnection (optional)
 * 
 * GET /api/plaid/cleanup - Clean up all orphaned data
 * GET /api/plaid/cleanup?userId=xxx - Clean up data for specific user
 */
export async function GET(req: NextRequest) {
  try {
    // Get current user (optional - can be called by system)
    const userId = await getCurrentUserId();
    
    // Get userId from query params if provided (for admin/system use)
    const searchParams = req.nextUrl.searchParams;
    const targetUserId = searchParams.get('userId') || userId || undefined;

    // Perform cleanup
    const result = await cleanupAllPlaidData(targetUserId);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Cleaned up ${result.connectionsCleaned} orphaned connections and ${result.transactionSyncCleaned} orphaned transaction sync records.`,
    });
  } catch (error: any) {
    console.error('Error during Plaid cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to perform cleanup', details: error.message },
      { status: 500 }
    );
  }
}

