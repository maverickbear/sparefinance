import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/src/infrastructure/database/supabase-server';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { syncAccountTransactionsBatched } from '@/lib/api/plaid/sync-batched';
import { formatTimestamp } from '@/src/infrastructure/utils/timestamp';
import { createTransaction } from '@/lib/api/transactions';
import { TransactionFormData, transactionSchema } from '@/src/domain/transactions/transactions.validations';
import { ZodError } from 'zod';

const MAX_JOBS_PER_RUN = 5;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 60000; // 1 minute base delay

async function processImportJobs(req: NextRequest) {
  try {
    // Security: Check for secret header, cron job authentication, or authenticated user
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const vercelCron = req.headers.get('x-vercel-cron');
    
    // Allow if: cron secret matches, vercel cron header present, OR authenticated user
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isVercelCron = !!vercelCron;
    const userId = await getCurrentUserId();
    const isAuthenticatedUser = !!userId;
    
    if (!isCronAuth && !isVercelCron && !isAuthenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role client for cron jobs (bypasses RLS)
    // Use regular server client for authenticated users (respects RLS)
    const supabase = (isCronAuth || isVercelCron) 
      ? createServiceRoleClient() 
      : await createServerClient();
    
    // Get pending jobs or failed jobs ready for retry
    // If triggered by authenticated user, only process their own jobs
    // If triggered by cron, process all jobs
    const now = new Date().toISOString();
    let query = supabase
      .from('ImportJob')
      .select('*')
      .or(`status.eq.pending,and(status.eq.failed,nextRetryAt.lte.${now})`)
      .order('createdAt', { ascending: true })
      .limit(MAX_JOBS_PER_RUN);
    
    // If authenticated user (not cron), filter by userId
    if (isAuthenticatedUser && !isCronAuth && !isVercelCron && userId) {
      query = query.eq('userId', userId);
    }
    
    const { data: jobs, error } = await query;

    if (error) {
      console.error('Error fetching import jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ 
        processed: 0,
        message: 'No pending jobs' 
      });
    }

    const results = [];

    for (const job of jobs) {
      try {
        // Update job status to processing
        await supabase
          .from('ImportJob')
          .update({ 
            status: 'processing',
            updatedAt: formatTimestamp(new Date()),
          })
          .eq('id', job.id);

        if (job.type === 'plaid_sync') {
          const result = await processPlaidSyncJob(supabase, job);
          results.push({ jobId: job.id, ...result });
        } else if (job.type === 'csv_import') {
          const result = await processCsvImportJob(supabase, job);
          results.push({ jobId: job.id, ...result });
        } else {
          // Other job types can be added here
          console.warn(`Unknown job type: ${job.type}`);
          await supabase
            .from('ImportJob')
            .update({
              status: 'failed',
              errorMessage: `Unknown job type: ${job.type}`,
              updatedAt: formatTimestamp(new Date()),
            })
            .eq('id', job.id);
          results.push({ 
            jobId: job.id, 
            error: `Unknown job type: ${job.type}` 
          });
        }
      } catch (error: any) {
        console.error(`Error processing job ${job.id}:`, error);
        
        const retryCount = (job.retryCount || 0) + 1;
        const shouldRetry = retryCount < MAX_RETRIES;
        
        if (shouldRetry) {
          // Calculate exponential backoff: 1min, 2min, 4min
          const retryDelay = RETRY_DELAY_BASE_MS * Math.pow(2, retryCount - 1);
          const nextRetryAt = new Date(Date.now() + retryDelay);
          
          await supabase
            .from('ImportJob')
            .update({
              status: 'failed',
              errorMessage: error.message || 'Unknown error',
              retryCount,
              nextRetryAt: formatTimestamp(nextRetryAt),
              updatedAt: formatTimestamp(new Date()),
            })
            .eq('id', job.id);
        } else {
          // Max retries reached, mark as permanently failed
          await supabase
            .from('ImportJob')
            .update({
              status: 'failed',
              errorMessage: error.message || 'Unknown error (max retries reached)',
              retryCount,
              nextRetryAt: null,
              updatedAt: formatTimestamp(new Date()),
            })
            .eq('id', job.id);
        }

        results.push({ 
          jobId: job.id, 
          error: error.message || 'Unknown error',
          retryCount,
          willRetry: shouldRetry
        });
      }
    }

    return NextResponse.json({
      processed: jobs.length,
      results,
    });
  } catch (error: any) {
    console.error('Error processing import jobs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process jobs' },
      { status: 500 }
    );
  }
}

// Support both GET (for Vercel cron jobs) and POST (for manual triggers)
export async function GET(req: NextRequest) {
  return processImportJobs(req);
}

export async function POST(req: NextRequest) {
  return processImportJobs(req);
}

async function processPlaidSyncJob(supabase: any, job: any) {
  const { accountId, metadata } = job;
  const { plaidAccountId, itemId } = metadata;

  if (!plaidAccountId || !itemId) {
    throw new Error('Missing plaidAccountId or itemId in job metadata');
  }

  // Get access token from PlaidConnection (never stored in job metadata for security)
  const { data: connection, error: connectionError } = await supabase
    .from('PlaidConnection')
    .select('accessToken')
    .eq('itemId', itemId)
    .single();

  if (connectionError || !connection?.accessToken) {
    throw new Error('Access token not found for Plaid connection');
  }

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

  return result;
}

async function processCsvImportJob(supabase: any, job: any) {
  const { metadata, userId } = job;
  const transactions = metadata?.transactions || [];

  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions found in job metadata');
  }

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
        // Pass userId for server-side operations (bypasses auth check)
        await createTransaction(validatedData, userId);
        synced++;
      } catch (error) {
        errors++;
        console.error('Error importing CSV transaction:', error);
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

  return { synced, skipped, errors, totalProcessed: transactions.length };
}

