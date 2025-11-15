import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
// import { createLinkToken } from '@/lib/api/plaid/connect'; // TEMPORARILY DISABLED
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

    // TEMPORARY BYPASS: Return a mock link token instead of calling Plaid
    console.log('[PLAID BYPASS] Creating mock link token for user:', userId);
    const mockLinkToken = `link-bypass-${Date.now()}-${userId.substring(0, 8)}`;
    
    // Original implementation (commented out):
    // const linkToken = await createLinkToken(userId);

    return NextResponse.json({ link_token: mockLinkToken });
  } catch (error: any) {
    console.error('Error creating link token:', error);
    
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
      { error: error.message || 'Failed to create link token' },
      { status: 500 }
    );
  }
}

