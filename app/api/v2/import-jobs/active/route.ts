import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeImportJobsService } from "@/src/application/import-jobs/import-jobs.factory";
import { makeAccountsService } from "@/src/application/accounts/accounts.factory";
import { AppError } from "@/src/application/shared/app-error";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const importJobsService = makeImportJobsService();
    const activeJobs = await importJobsService.getActiveImportJobs();

    // If no active jobs, return empty array
    if (activeJobs.length === 0) {
      return NextResponse.json({ jobs: [], accounts: [] }, {
      });
    }

    // Get account IDs from jobs
    const accountIds = activeJobs
      .map(job => job.accountId)
      .filter((id): id is string => id !== null);

    // Fetch account names
    const accountsMap = new Map<string, { id: string; name: string }>();
    if (accountIds.length > 0) {
      const accountsService = makeAccountsService();
      const accounts = await accountsService.getAccounts(undefined, undefined, { includeHoldings: false });
      
      accounts.forEach(account => {
        if (accountIds.includes(account.id)) {
          accountsMap.set(account.id, { id: account.id, name: account.name });
        }
      });
    }

    return NextResponse.json({
      jobs: activeJobs,
      accounts: Array.from(accountsMap.values()),
    }, {
    });
  } catch (error) {
    console.error("Error fetching active import jobs:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch active import jobs" },
      { status: 500 }
    );
  }
}

