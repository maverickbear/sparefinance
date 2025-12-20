import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/src/infrastructure/database/supabase-server';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { formatTimestamp } from '@/src/infrastructure/utils/timestamp';
import { makeTransactionsService } from '@/src/application/transactions/transactions.factory';
import { TransactionFormData, transactionSchema } from '@/src/domain/transactions/transactions.validations';
import { AppError } from '@/src/application/shared/app-error';
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
      .from('system_jobs_imports')
      .select('*')
      .or(`status.eq.pending,and(status.eq.failed,next_retry_at.lte.${now})`)
      .order('created_at', { ascending: true })
      .limit(MAX_JOBS_PER_RUN);
    
    // If authenticated user (not cron), filter by userId
    if (isAuthenticatedUser && !isCronAuth && !isVercelCron && userId) {
      query = query.eq('user_id', userId);
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
          .from('system_jobs_imports')
          .update({ 
            status: 'processing',
            updated_at: formatTimestamp(new Date()),
          })
          .eq('id', job.id);

        if (job.type === 'csv_import') {
          const result = await processCsvImportJob(supabase, job);
          results.push({ jobId: job.id, ...result });
        } else {
          // Other job types can be added here
          console.warn(`Unknown job type: ${job.type}`);
          await supabase
            .from('system_jobs_imports')
            .update({
              status: 'failed',
              error_message: `Unknown job type: ${job.type}`,
              updated_at: formatTimestamp(new Date()),
            })
            .eq('id', job.id);
          results.push({ 
            jobId: job.id, 
            error: `Unknown job type: ${job.type}` 
          });
        }
      } catch (error: any) {
        console.error(`Error processing job ${job.id}:`, error);
        
        const retryCount = (job.retry_count || 0) + 1;
        const shouldRetry = retryCount < MAX_RETRIES;
        
        if (shouldRetry) {
          // Calculate exponential backoff: 1min, 2min, 4min
          const retryDelay = RETRY_DELAY_BASE_MS * Math.pow(2, retryCount - 1);
          const nextRetryAt = new Date(Date.now() + retryDelay);
          
          await supabase
            .from('system_jobs_imports')
            .update({
              status: 'failed',
              error_message: error.message || 'Unknown error',
              retry_count: retryCount,
              next_retry_at: formatTimestamp(nextRetryAt),
              updated_at: formatTimestamp(new Date()),
            })
            .eq('id', job.id);
        } else {
          // Max retries reached, mark as permanently failed
          await supabase
            .from('system_jobs_imports')
            .update({
              status: 'failed',
              error_message: error.message || 'Unknown error (max retries reached)',
              retry_count: retryCount,
              next_retry_at: null,
              updated_at: formatTimestamp(new Date()),
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


async function processCsvImportJob(supabase: any, job: any) {
  const { metadata, user_id } = job;
  const userId = user_id; // Map snake_case to camelCase
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
        // Use TransactionsService for server-side operations
        const transactionsService = makeTransactionsService();
        await transactionsService.createTransaction(validatedData, userId);
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
      .from('system_jobs_imports')
      .update({
        progress,
        processed_items: processed,
        synced_items: synced,
        skipped_items: skipped,
        error_items: errors,
        updated_at: formatTimestamp(new Date()),
      })
      .eq('id', job.id);

    // Small delay between batches
    if (i + batchSize < transactions.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Update job as completed
  await supabase
    .from('system_jobs_imports')
    .update({
      status: 'completed',
      progress: 100,
      processed_items: transactions.length,
      synced_items: synced,
      skipped_items: skipped,
      error_items: errors,
      completed_at: formatTimestamp(new Date()),
      updated_at: formatTimestamp(new Date()),
    })
    .eq('id', job.id);

  return { synced, skipped, errors, totalProcessed: transactions.length };
}

