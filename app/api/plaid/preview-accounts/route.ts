import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/api/feature-guard';
import { exchangePublicToken } from '@/lib/api/plaid/connect';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Preview accounts before importing them
 * This endpoint exchanges the public token and returns account information
 * without creating accounts in the database
 */
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

    // Parse request body
    const body = await req.json();
    const { publicToken, metadata } = body;

    if (!publicToken || !metadata) {
      return NextResponse.json(
        { error: 'Missing publicToken or metadata' },
        { status: 400 }
      );
    }

    // Exchange public token for access token and get accounts
    // This creates a PlaidConnection but doesn't create accounts yet
    console.log('[PLAID PREVIEW] Exchanging public token for preview...');
    const { itemId, accessToken, accounts } = await exchangePublicToken(
      publicToken,
      metadata
    );
    console.log('[PLAID PREVIEW] Exchange successful:', {
      itemId,
      accountCount: accounts.length,
      institution: metadata.institution?.name,
    });

    // Map accounts with suggested types
    const mappedAccounts = accounts.map((plaidAccount) => {
      const plaidType = plaidAccount.type?.toLowerCase();
      const plaidSubtype = plaidAccount.subtype?.toLowerCase();
      
      let suggestedType: 'checking' | 'savings' | 'credit' | 'investment' | 'other' = 'checking';
      
      if (plaidType === 'depository') {
        if (plaidSubtype === 'savings' || 
            plaidSubtype === 'cd' || 
            plaidSubtype === 'money market' ||
            plaidSubtype === 'savings account') {
          suggestedType = 'savings';
        } else if (plaidSubtype === 'checking' || 
                   plaidSubtype === 'checking account') {
          suggestedType = 'checking';
        } else {
          suggestedType = 'checking';
        }
      } else if (plaidType === 'credit') {
        suggestedType = 'credit';
      } else if (plaidType === 'loan') {
        suggestedType = 'other';
      } else if (plaidType === 'investment') {
        suggestedType = 'investment';
      } else {
        suggestedType = 'other';
      }

      return {
        accountId: plaidAccount.account_id,
        name: plaidAccount.name,
        plaidType: plaidType,
        plaidSubtype: plaidSubtype,
        suggestedType: suggestedType,
        balance: plaidAccount.balances?.current ?? plaidAccount.balances?.available ?? 0,
        currencyCode: plaidAccount.balances?.iso_currency_code ?? plaidAccount.balances?.unofficial_currency_code ?? 'USD',
        mask: (plaidAccount as any).mask || null,
        officialName: (plaidAccount as any).official_name || null,
      };
    });

    console.log('[PLAID PREVIEW] Returning preview data:', {
      itemId,
      accountCount: mappedAccounts.length,
      institution: metadata.institution?.name,
    });

    return NextResponse.json({
      success: true,
      itemId, // Use itemId to retrieve connection in final import
      institution: metadata.institution,
      accounts: mappedAccounts,
    });
  } catch (error: any) {
    console.error('[PLAID PREVIEW] Error previewing accounts:', {
      error: error.message,
      stack: error.stack,
      response: error.response?.data,
    });
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to preview accounts',
        details: error.response?.data?.error_message || undefined,
      },
      { status: 500 }
    );
  }
}

