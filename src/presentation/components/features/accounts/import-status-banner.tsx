"use client";

import { useEffect, useState, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Database, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ImportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  syncedItems: number;
  accountId: string | null;
  createdAt: string;
  type: string;
}

interface AccountInfo {
  id: string;
  name: string;
}

export function ImportStatusBanner() {
  const [activeJobs, setActiveJobs] = useState<ImportJob[]>([]);
  const [accounts, setAccounts] = useState<Map<string, AccountInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initial fetch
    const fetchActiveJobs = async () => {
      try {
        const response = await fetch("/api/v2/import-jobs/active");
        if (!response.ok) {
          if (response.status === 401) {
            // User not authenticated, no jobs to show
            setActiveJobs([]);
            setLoading(false);
            // Stop polling if no auth
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            return;
          }
          console.error('Error fetching import jobs:', response.statusText);
          setLoading(false);
          return;
        }

        const data = await response.json();
        const jobs = data.jobs || [];
        const accountsData = data.accounts || [];

        // Filter only active jobs (pending or processing)
        const activeJobsOnly = jobs.filter((job: ImportJob) => 
          job.status === 'pending' || job.status === 'processing'
        ) as ImportJob[];

        if (activeJobsOnly.length > 0) {
          setActiveJobs(activeJobsOnly);

          // Map accounts
          const accountMap = new Map<string, AccountInfo>();
          accountsData.forEach((acc: AccountInfo) => {
            accountMap.set(acc.id, acc);
          });
          setAccounts(accountMap);

          // Only start polling if there are active jobs and polling isn't already running
          if (!pollIntervalRef.current) {
            pollIntervalRef.current = setInterval(() => {
              fetchActiveJobs();
            }, 5000);
          }
        } else {
          // No active jobs - stop polling and clear state
          setActiveJobs([]);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error in fetchActiveJobs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveJobs();

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return null;
  }

  if (activeJobs.length === 0) {
    return null;
  }

  // Calculate overall progress
  const totalProgress = activeJobs.length > 0
    ? Math.round(
        activeJobs.reduce((sum, job) => sum + (job.progress || 0), 0) / activeJobs.length
      )
    : 0;

  const totalItems = activeJobs.reduce((sum, job) => sum + (job.totalItems || 0), 0);
  const totalProcessed = activeJobs.reduce((sum, job) => sum + (job.processedItems || 0), 0);
  const totalSynced = activeJobs.reduce((sum, job) => sum + (job.syncedItems || 0), 0);

  // Get account names
  const accountNames = activeJobs
    .map(job => {
      const account = job.accountId ? accounts.get(job.accountId) : null;
      return account?.name || 'Account';
    })
    .filter((name, index, self) => self.indexOf(name) === index); // Unique names

  return (
    <Alert className="mb-4 border-interactive-primary/30 bg-interactive-primary/10">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="font-semibold">
                  Importing transactions from {accountNames.length > 0 ? accountNames.join(', ') : 'your accounts'}...
                </span>
              </div>
              
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p>
                  This may take a few minutes to several hours depending on the number of transactions.
                  You can continue using the app while the import runs in the background.
                </p>
                
                {totalItems > 0 && (
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        Processing {totalProcessed.toLocaleString()} of {totalItems.toLocaleString()} transactions
                        {totalSynced > 0 && ` • ${totalSynced.toLocaleString()} imported`}
                      </span>
                      <span className="font-medium">{totalProgress}%</span>
                    </div>
                    <Progress value={totalProgress} className="h-2" />
                  </div>
                )}

                {activeJobs.some(j => j.status === 'pending') && (
                  <div className="flex items-center gap-1 text-xs mt-2">
                    <Clock className="h-3 w-3" />
                    <span>Waiting for import to start...</span>
                  </div>
                )}
              </div>
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

