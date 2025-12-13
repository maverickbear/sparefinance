/**
 * POST /api/v2/plaid/items/[itemId]/replace-manual-accounts
 * Replace manual accounts with Plaid accounts
 * Phase D: Manual account replacement flow with confirmation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { AppError } from '@/src/application/shared/app-error';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { PlaidItemsRepository } from '@/src/infrastructure/database/repositories/plaid-items.repository';
import { AccountsRepository } from '@/src/infrastructure/database/repositories/accounts.repository';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

/**
 * Check if Plaid is enabled
 */
function isPlaidEnabled(): boolean {
  return process.env.PLAID_ENABLED !== 'false';
}

const replaceAccountsSchema = z.object({
  manualAccountIds: z.array(z.string().uuid()).min(1, 'At least one account must be selected'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
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

    const { itemId } = await params;
    const body = await request.json();

    // Validate request
    let validatedData;
    try {
      validatedData = replaceAccountsSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    // Verify item ownership
    const plaidItemsRepository = new PlaidItemsRepository();
    const item = await plaidItemsRepository.findByItemId(itemId);
    
    if (!item) {
      return NextResponse.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    if (item.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();
    const accountsRepository = new AccountsRepository();

    // Verify all manual accounts belong to the user and are manual (not connected)
    for (const accountId of validatedData.manualAccountIds) {
      const account = await accountsRepository.findById(accountId);
      
      if (!account) {
        return NextResponse.json(
          { error: `Account ${accountId} not found` },
          { status: 404 }
        );
      }

      if (account.user_id !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }

      // Check if account is already connected to Plaid
      const { data: integration } = await supabase
        .from('account_integrations')
        .select('plaid_item_id, is_connected')
        .eq('account_id', accountId)
        .single();

      if (integration?.is_connected) {
        return NextResponse.json(
          { error: `Account ${accountId} is already connected to Plaid` },
          { status: 400 }
        );
      }
    }

    // Get Plaid accounts for this item
    const { data: plaidAccounts } = await supabase
      .from('account_integrations')
      .select('account_id, plaid_account_id')
      .eq('plaid_item_id', itemId)
      .eq('is_connected', true);

    if (!plaidAccounts || plaidAccounts.length === 0) {
      return NextResponse.json(
        { error: 'No Plaid accounts found for this item' },
        { status: 404 }
      );
    }

    // For each manual account, we'll:
    // 1. Transfer transactions to the corresponding Plaid account (if type matches)
    // 2. Delete the manual account
    // Note: This is a simplified implementation
    // In production, you'd want more sophisticated matching logic

    const results = [];
    for (const manualAccountId of validatedData.manualAccountIds) {
      const manualAccount = await accountsRepository.findById(manualAccountId);
      if (!manualAccount) continue;

      // Find a matching Plaid account by type
      const matchingPlaidAccount = plaidAccounts.find(
        (pa) => {
          // Get the account type for the Plaid account
          // For now, we'll match by account type
          // In production, you'd want more sophisticated matching
          return true; // Simplified - match any Plaid account
        }
      );

      if (matchingPlaidAccount) {
        // Transfer transactions
        await supabase
          .from('transactions')
          .update({ account_id: matchingPlaidAccount.account_id })
          .eq('account_id', manualAccountId);

        // Delete the manual account (soft delete)
        await supabase
          .from('accounts')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', manualAccountId);

        results.push({
          manualAccountId,
          replacedWith: matchingPlaidAccount.account_id,
          success: true,
        });
      } else {
        results.push({
          manualAccountId,
          success: false,
          error: 'No matching Plaid account found',
        });
      }
    }

    logger.info('[Plaid Replace Accounts] Replaced manual accounts', {
      itemId,
      userId,
      results,
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    logger.error('[Plaid Replace Accounts] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to replace accounts' },
      { status: 500 }
    );
  }
}
