import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
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

    // Parse request body to get account type
    const body = await req.json().catch(() => ({}));
    const accountType = body.accountType || 'bank'; // 'bank' or 'investment'

    // Create link token using Plaid API with account type
    const { createLinkToken } = await import('@/lib/api/plaid/connect');
    const linkToken = await createLinkToken(userId, accountType);

    return NextResponse.json({ link_token: linkToken });
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

