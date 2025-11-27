/**
 * Script to manually process pending ImportJob records
 * 
 * Usage:
 *   npx tsx scripts/process-import-jobs.ts
 * 
 * Or with specific job ID:
 *   npx tsx scripts/process-import-jobs.ts <jobId>
 */

import { createServiceRoleClient } from '@/lib/supabase-server';
import { syncAccountTransactionsBatched } from '@/lib/api/plaid/sync-batched';
import { formatTimestamp } from '@/lib/utils/timestamp';
import { createTransaction } from '@/lib/api/transactions';
import { TransactionFormData, transactionSchema } from '@/lib/validations/transaction';

const MAX_JOBS_PER_RUN = 5;

async function processPlaidSyncJob(supabase: any, job: any) {
  const { accountId, metadata } = job;
  const { plaidAccountId, itemId } = metadata;

  if (!plaidAccountId || !itemId) {
    throw new Error('Missing plaidAccountId or itemId in job metadata');
  }

  // Get access token from PlaidConnection
  const { data: connection, error: connectionError } = await supabase
    .from('PlaidConnection')
    .select('accessToken')
    .eq('itemId', itemId)
    .single();

  if (connectionError || !connection?.accessToken) {
    throw new Error('Access token not found for Plaid connection');
  }

  console.log(`Processing Plaid sync job ${job.id} for account ${accountId}...`);

  // Process sync with batched function
  const result = await syncAccountTransactionsBatched(
    accountId,
    plaidAccountId,
    connection.accessToken,
    job.id
  );

  // Update job as completed
  await supabase
    .from('ImportJob')
    .update({
      status: 'completed',
      progress: 100,
      processedItems: result.totalProcessed,
      syncedItems: result.synced,
      skippedItems: result.skipped,
      errorItems: result.errors,
      completedAt: formatTimestamp(new Date()),
      updatedAt: formatTimestamp(new Date()),
    })
    .eq('id', job.id);

  console.log(`Job ${job.id} completed:`, result);
  return result;
}

async function processCsvImportJob(supabase: any, job: any) {
  const { metadata } = job;
  const transactions = metadata?.transactions || [];

  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions found in job metadata');
  }

  console.log(`Processing CSV import job ${job.id} with ${transactions.length} transactions...`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  const batchSize = 50;

  // Process transactions in batches
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);

    for (const tx of batch) {
      try {
        const data: TransactionFormData = {
          date: tx.date instanceof Date ? tx.date : new Date(tx.date),
          type: tx.type,
          amount: tx.amount,
          accountId: tx.accountId,
          toAccountId: tx.toAccountId,
          categoryId: tx.categoryId || undefined,
          subcategoryId: tx.subcategoryId || undefined,
          description: tx.description || undefined,
          recurring: tx.recurring || false,
          expenseType: tx.expenseType || undefined,
        };

        const validatedData = transactionSchema.parse(data);
        await createTransaction(validatedData);
        synced++;
      } catch (error) {
        errors++;
        console.error(`Error importing CSV transaction:`, error);
      }
    }

    // Update job progress after each batch
    const processed = i + batch.length;
    const progress = transactions.length > 0 
      ? Math.round((processed / transactions.length) * 100)
      : 100;

    await supabase
      .from('ImportJob')
      .update({
        progress,
        processedItems: processed,
        syncedItems: synced,
        skippedItems: skipped,
        errorItems: errors,
        updatedAt: formatTimestamp(new Date()),
      })
      .eq('id', job.id);

    console.log(`Progress: ${progress}% (${processed}/${transactions.length})`);

    // Small delay between batches
    if (i + batchSize < transactions.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Update job as completed
  await supabase
    .from('ImportJob')
    .update({
      status: 'completed',
      progress: 100,
      processedItems: transactions.length,
      syncedItems: synced,
      skippedItems: skipped,
      errorItems: errors,
      completedAt: formatTimestamp(new Date()),
      updatedAt: formatTimestamp(new Date()),
    })
    .eq('id', job.id);

  console.log(`Job ${job.id} completed: ${synced} synced, ${skipped} skipped, ${errors} errors`);
  return { synced, skipped, errors, totalProcessed: transactions.length };
}

async function main() {
  const jobId = process.argv[2];
  const supabase = createServiceRoleClient();

  try {
    if (jobId) {
      // Process specific job
      console.log(`Fetching job ${jobId}...`);
      const { data: job, error } = await supabase
        .from('ImportJob')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        console.error('Job not found:', error);
        process.exit(1);
      }

      if (job.status === 'completed') {
        console.log('Job is already completed');
        process.exit(0);
      }

      if (job.status === 'processing') {
        console.log('Job is currently processing');
        process.exit(0);
      }

      // Update job status to processing
      await supabase
        .from('ImportJob')
        .update({ 
          status: 'processing',
          updatedAt: formatTimestamp(new Date()),
        })
        .eq('id', job.id);

      try {
        if (job.type === 'plaid_sync') {
          await processPlaidSyncJob(supabase, job);
        } else if (job.type === 'csv_import') {
          await processCsvImportJob(supabase, job);
        } else {
          throw new Error(`Unknown job type: ${job.type}`);
        }
        console.log('Job processed successfully');
      } catch (error: any) {
        console.error('Error processing job:', error);
        await supabase
          .from('ImportJob')
          .update({
            status: 'failed',
            errorMessage: error.message || 'Unknown error',
            updatedAt: formatTimestamp(new Date()),
          })
          .eq('id', job.id);
        process.exit(1);
      }
    } else {
      // Process all pending jobs
      console.log('Fetching pending jobs...');
      const now = new Date().toISOString();
      const { data: jobs, error } = await supabase
        .from('ImportJob')
        .select('*')
        .or(`status.eq.pending,and(status.eq.failed,nextRetryAt.lte.${now})`)
        .order('createdAt', { ascending: true })
        .limit(MAX_JOBS_PER_RUN);

      if (error) {
        console.error('Error fetching jobs:', error);
        process.exit(1);
      }

      if (!jobs || jobs.length === 0) {
        console.log('No pending jobs found');
        process.exit(0);
      }

      console.log(`Found ${jobs.length} job(s) to process`);

      for (const job of jobs) {
        try {
          console.log(`\nProcessing job ${job.id} (type: ${job.type}, status: ${job.status})...`);
          
          // Update job status to processing
          await supabase
            .from('ImportJob')
            .update({ 
              status: 'processing',
              updatedAt: formatTimestamp(new Date()),
            })
            .eq('id', job.id);

          if (job.type === 'plaid_sync') {
            await processPlaidSyncJob(supabase, job);
          } else if (job.type === 'csv_import') {
            await processCsvImportJob(supabase, job);
          } else {
            throw new Error(`Unknown job type: ${job.type}`);
          }
        } catch (error: any) {
          console.error(`Error processing job ${job.id}:`, error);
          await supabase
            .from('ImportJob')
            .update({
              status: 'failed',
              errorMessage: error.message || 'Unknown error',
              updatedAt: formatTimestamp(new Date()),
            })
            .eq('id', job.id);
        }
      }

      console.log('\nAll jobs processed');
    }
  } catch (error: any) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();

