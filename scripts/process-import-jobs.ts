/**
 * Script to manually process pending ImportJob records
 * 
 * This script calls the API endpoint to process jobs, avoiding
 * Next.js cookie dependencies that don't work in standalone scripts.
 * 
 * Usage:
 *   npx tsx --env-file=.env.local scripts/process-import-jobs.ts
 * 
 * Or with specific job ID:
 *   npx tsx --env-file=.env.local scripts/process-import-jobs.ts <jobId>
 */

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cronSecret = process.env.CRON_SECRET;
const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!supabaseUrl) {
  console.error('❌ Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  console.error('\nPlease ensure this variable is set in .env.local');
  process.exit(1);
}

const MAX_JOBS_PER_RUN = 5;

/**
 * Call the API endpoint to process import jobs
 */
async function callProcessEndpoint(jobId?: string) {
  const url = `${apiUrl}/api/import-jobs/process`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Use CRON_SECRET if available, otherwise the endpoint will check for authenticated user
  if (cronSecret) {
    headers['Authorization'] = `Bearer ${cronSecret}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    if (error.message?.includes('fetch')) {
      throw new Error(`Failed to connect to API at ${url}. Make sure the server is running or set NEXT_PUBLIC_APP_URL correctly.`);
    }
    throw error;
  }
}

async function main() {
  const jobId = process.argv[2];

  try {
    console.log('Calling API endpoint to process import jobs...');
    if (jobId) {
      console.log(`Note: Processing all pending jobs (job ID ${jobId} will be processed if it's pending)`);
    }

    const result = await callProcessEndpoint(jobId);

    if (result.processed === 0) {
      console.log('No pending jobs to process');
    } else {
      console.log(`\n✅ Processed ${result.processed} job(s)`);
      if (result.results && result.results.length > 0) {
        console.log('\nResults:');
        result.results.forEach((r: any) => {
          if (r.error) {
            console.log(`  ❌ Job ${r.jobId}: ${r.error}`);
          } else {
            console.log(`  ✅ Job ${r.jobId}: ${r.synced || 0} synced, ${r.skipped || 0} skipped, ${r.errors || 0} errors`);
          }
        });
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message?.includes('connect to API')) {
      console.error('\n💡 Tip: Make sure your Next.js server is running, or set NEXT_PUBLIC_APP_URL to your production URL');
    }
    process.exit(1);
  }
}

main();

