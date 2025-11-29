import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { guardBankIntegration, getCurrentUserId } from '@/src/application/shared/feature-guard';
import { throwIfNotAllowed } from '@/src/application/shared/feature-guard';
import { CountryCode } from 'plaid';

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

    // Parse request body to get account type and country
    const body = await req.json().catch(() => ({}));
    const accountType = body.accountType || 'bank'; // 'bank', 'investment', or 'both'
    const country = body.country || 'US'; // 'US' or 'CA'
    
    // Map country string to CountryCode
    const countryCode = country.toUpperCase() === 'CA' ? CountryCode.Ca : CountryCode.Us;

    // Create link token using Plaid API with account type and country
    const { createLinkToken } = await import('@/lib/api/plaid/connect');
    const linkToken = await createLinkToken(userId, accountType, countryCode);

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

