"use server";

import { createServerClient } from '@/lib/supabase-server';
import { logger } from '@/lib/utils/logger';

const log = logger.withPrefix("DeduplicateTransactions");

/**
 * Find and remove duplicate transactions
 * Duplicates are identified by having the same plaidTransactionId
 * Keeps the oldest transaction and removes the rest
 */
export async function deduplicateTransactions(accountId?: string): Promise<{
  duplicatesFound: number;
  duplicatesRemoved: number;
  errors: number;
}> {
  const supabase = await createServerClient();
  let duplicatesFound = 0;
  let duplicatesRemoved = 0;
  let errors = 0;

  try {
    log.log("Starting duplicate transaction cleanup", { accountId });

    // Get all TransactionSync records, grouped by plaidTransactionId
    // Find those with multiple transactionIds (duplicates)
    let query = supabase
      .from('TransactionSync')
      .select('plaidTransactionId, transactionId, accountId, syncDate, id')
      .not('transactionId', 'is', null)
      .order('syncDate', { ascending: true }); // Oldest first

    if (accountId) {
      query = query.eq('accountId', accountId);
    }

    const { data: allSyncs, error: fetchError } = await query;

    if (fetchError) {
      log.error("Error fetching TransactionSync records:", fetchError);
      throw fetchError;
    }

    if (!allSyncs || allSyncs.length === 0) {
      log.log("No TransactionSync records found");
      return { duplicatesFound: 0, duplicatesRemoved: 0, errors: 0 };
    }

    // Group by plaidTransactionId
    const syncsByPlaidId = new Map<string, typeof allSyncs>();
    for (const sync of allSyncs) {
      if (!sync.plaidTransactionId) continue;
      
      if (!syncsByPlaidId.has(sync.plaidTransactionId)) {
        syncsByPlaidId.set(sync.plaidTransactionId, []);
      }
      syncsByPlaidId.get(sync.plaidTransactionId)!.push(sync);
    }

    // Find duplicates (plaidTransactionIds with more than one transactionId)
    const duplicates: Array<{ plaidId: string; syncs: typeof allSyncs }> = [];
    for (const [plaidId, syncs] of syncsByPlaidId.entries()) {
      // Get unique transactionIds
      const uniqueTransactionIds = new Set(
        syncs.map(s => s.transactionId).filter(Boolean)
      );

      if (uniqueTransactionIds.size > 1) {
        duplicates.push({ plaidId, syncs });
        duplicatesFound += uniqueTransactionIds.size - 1; // All but one are duplicates
      }
    }

    log.log(`Found ${duplicates.length} plaidTransactionIds with duplicates`, {
      totalDuplicates: duplicatesFound,
    });

    // For each duplicate group, keep the oldest and remove the rest
    for (const { plaidId, syncs } of duplicates) {
      try {
        // Sort by syncDate (oldest first) - keep the first one
        const sorted = [...syncs].sort((a, b) => {
          const dateA = new Date(a.syncDate || 0).getTime();
          const dateB = new Date(b.syncDate || 0).getTime();
          return dateA - dateB;
        });

        const keepSync = sorted[0];
        const removeSyncs = sorted.slice(1);

        log.log(`Processing duplicates for plaidTransactionId: ${plaidId}`, {
          keeping: keepSync.transactionId,
          removing: removeSyncs.map(s => s.transactionId),
        });

        // Remove duplicate transactions and their sync records
        for (const removeSync of removeSyncs) {
          if (!removeSync.transactionId) continue;

          // Delete the transaction
          const { error: deleteTxError } = await supabase
            .from('Transaction')
            .delete()
            .eq('id', removeSync.transactionId);

          if (deleteTxError) {
            log.error(`Error deleting duplicate transaction ${removeSync.transactionId}:`, deleteTxError);
            errors++;
            continue;
          }

          // Delete the TransactionSync record
          const { error: deleteSyncError } = await supabase
            .from('TransactionSync')
            .delete()
            .eq('id', removeSync.id);

          if (deleteSyncError) {
            log.error(`Error deleting TransactionSync ${removeSync.id}:`, deleteSyncError);
            errors++;
            continue;
          }

          duplicatesRemoved++;
          log.log(`Removed duplicate transaction: ${removeSync.transactionId}`);
        }
      } catch (error) {
        log.error(`Error processing duplicates for plaidTransactionId ${plaidId}:`, error);
        errors++;
      }
    }

    log.log("Duplicate cleanup completed", {
      duplicatesFound,
      duplicatesRemoved,
      errors,
    });

    return { duplicatesFound, duplicatesRemoved, errors };
  } catch (error: any) {
    log.error("Error in deduplicateTransactions:", error);
    throw error;
  }
}

