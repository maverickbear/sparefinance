/**
 * Cleanup utilities for Plaid integration
 * Handles orphaned connections and data cleanup
 */

import { createServerClient } from '@/lib/supabase-server';
import { formatTimestamp } from '@/lib/utils/timestamp';

/**
 * Clean up orphaned PlaidConnections
 * A connection is considered orphaned if:
 * 1. No accounts reference its itemId, OR
 * 2. All accounts referencing it are disconnected (isConnected = false)
 * 
 * @param userId Optional: Only clean connections for this user
 * @returns Number of connections cleaned up
 */
export async function cleanupOrphanedPlaidConnections(
  userId?: string
): Promise<number> {
  const supabase = await createServerClient();
  let cleaned = 0;

  try {
    // Get all PlaidConnections
    let query = supabase
      .from('PlaidConnection')
      .select('id, itemId, userId');

    if (userId) {
      query = query.eq('userId', userId);
    }

    const { data: connections, error } = await query;

    if (error || !connections) {
      console.error('Error fetching PlaidConnections:', error);
      return 0;
    }

    // Check each connection
    for (const connection of connections) {
      // Check if any connected accounts exist for this itemId
      const { data: connectedAccounts } = await supabase
        .from('Account')
        .select('id')
        .eq('plaidItemId', connection.itemId)
        .eq('isConnected', true)
        .limit(1);

      // If no connected accounts exist, this connection is orphaned
      if (!connectedAccounts || connectedAccounts.length === 0) {
        console.log('[PLAID CLEANUP] Removing orphaned PlaidConnection:', {
          id: connection.id,
          itemId: connection.itemId,
          userId: connection.userId,
        });

        const { error: deleteError } = await supabase
          .from('PlaidConnection')
          .delete()
          .eq('id', connection.id);

        if (deleteError) {
          console.error('[PLAID CLEANUP] Error deleting orphaned connection:', deleteError);
        } else {
          cleaned++;
        }
      }
    }

    return cleaned;
  } catch (error) {
    console.error('[PLAID CLEANUP] Error during cleanup:', error);
    return cleaned;
  }
}

/**
 * Clean up orphaned TransactionSync records
 * A TransactionSync is orphaned if:
 * 1. The account it references no longer exists, OR
 * 2. The account is disconnected and has no plaidAccountId
 * 
 * Note: Foreign key CASCADE should handle case 1, but this is a safety net
 * 
 * @param accountId Optional: Only clean syncs for this account
 * @returns Number of sync records cleaned up
 */
export async function cleanupOrphanedTransactionSync(
  accountId?: string
): Promise<number> {
  const supabase = await createServerClient();
  let cleaned = 0;

  try {
    // Get TransactionSync records that reference disconnected accounts
    let query = supabase
      .from('TransactionSync')
      .select('id, accountId, plaidTransactionId')
      .not('accountId', 'is', null);

    if (accountId) {
      query = query.eq('accountId', accountId);
    }

    const { data: syncRecords, error } = await query;

    if (error || !syncRecords) {
      console.error('Error fetching TransactionSync records:', error);
      return 0;
    }

    // Check each sync record
    for (const syncRecord of syncRecords) {
      const { data: account } = await supabase
        .from('Account')
        .select('id, plaidAccountId, isConnected')
        .eq('id', syncRecord.accountId)
        .single();

      // If account doesn't exist or is disconnected without plaidAccountId, clean up
      if (!account || (!account.isConnected && !account.plaidAccountId)) {
        console.log('[PLAID CLEANUP] Removing orphaned TransactionSync:', {
          id: syncRecord.id,
          accountId: syncRecord.accountId,
          plaidTransactionId: syncRecord.plaidTransactionId,
        });

        const { error: deleteError } = await supabase
          .from('TransactionSync')
          .delete()
          .eq('id', syncRecord.id);

        if (deleteError) {
          console.error('[PLAID CLEANUP] Error deleting orphaned TransactionSync:', deleteError);
        } else {
          cleaned++;
        }
      }
    }

    return cleaned;
  } catch (error) {
    console.error('[PLAID CLEANUP] Error during TransactionSync cleanup:', error);
    return cleaned;
  }
}

/**
 * Comprehensive cleanup of all Plaid-related orphaned data
 * 
 * @param userId Optional: Only clean data for this user
 * @returns Summary of cleanup operations
 */
export async function cleanupAllPlaidData(
  userId?: string
): Promise<{
  connectionsCleaned: number;
  transactionSyncCleaned: number;
}> {
  console.log('[PLAID CLEANUP] Starting comprehensive cleanup...', {
    userId: userId || 'all users',
  });

  const connectionsCleaned = await cleanupOrphanedPlaidConnections(userId);
  const transactionSyncCleaned = await cleanupOrphanedTransactionSync();

  console.log('[PLAID CLEANUP] Cleanup complete:', {
    connectionsCleaned,
    transactionSyncCleaned,
  });

  return {
    connectionsCleaned,
    transactionSyncCleaned,
  };
}

