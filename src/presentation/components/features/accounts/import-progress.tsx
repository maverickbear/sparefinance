"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/infrastructure/database/supabase-client";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { logger } from "@/src/infrastructure/utils/logger";

interface ImportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  syncedItems: number;
  skippedItems: number;
  errorItems: number;
  errorMessage: string | null;
  accountId: string | null;
}

interface ImportProgressProps {
  jobIds: string[];
  onComplete?: () => void;
}

export function ImportProgress({ jobIds, onComplete }: ImportProgressProps) {
  const [jobs, setJobs] = useState<Record<string, ImportJob>>({});

  useEffect(() => {
    if (jobIds.length === 0) return;

    // Initial fetch of job statuses
    const fetchJobs = async () => {
      for (const jobId of jobIds) {
        try {
          const response = await fetch(`/api/import-jobs/${jobId}`);
          if (response.ok) {
            const job = await response.json();
            setJobs(prev => ({ ...prev, [jobId]: job }));
          }
        } catch (error) {
          logger.error(`Error fetching job ${jobId}:`, error);
        }
      }
    };

    fetchJobs();

    // Set up Realtime subscription for ImportJob table
    // Subscribe to each job individually (Supabase Realtime doesn't support IN filters easily)
    const channels: ReturnType<typeof supabase.channel>[] = [];
    
    jobIds.forEach((jobId) => {
      const channel = supabase
        .channel(`import-job-${jobId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ImportJob",
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const job = payload.new as ImportJob;
            setJobs(prev => {
              const updated = { ...prev, [job.id]: job };
              
              // Check if all jobs are completed
              const allCompleted = jobIds.every(id => {
                const j = updated[id];
                return j && (j.status === 'completed' || j.status === 'failed');
              });

              if (allCompleted && onComplete) {
                // Small delay to ensure UI updates
                setTimeout(() => onComplete(), 1000);
              }
              
              return updated;
            });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            logger.info(`[ImportProgress] Realtime subscription active for job ${jobId}`);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            logger.warn(`[ImportProgress] Realtime subscription error for job ${jobId}:`, status);
          }
        });
      
      channels.push(channel);
    });

    // Cleanup
    return () => {
      channels.forEach(channel => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, [jobIds, onComplete]);

  if (Object.keys(jobs).length === 0) {
    return null;
  }

  const allJobs = Object.values(jobs);
  const hasActiveJobs = allJobs.some(j => j.status === 'pending' || j.status === 'processing');
  const hasFailedJobs = allJobs.some(j => j.status === 'failed');

  if (!hasActiveJobs && !hasFailedJobs) {
    // All jobs completed successfully
    return (
      <Alert className="mb-4 border-sentiment-positive/30 bg-sentiment-positive/10">
        <CheckCircle2 className="h-4 w-4 text-sentiment-positive" />
        <AlertDescription className="text-green-800">
          Import completed successfully! {allJobs.reduce((sum, j) => sum + (j.syncedItems || 0), 0)} transactions imported.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4 mb-4">
      {allJobs.map((job) => (
        <div key={job.id} className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {job.status === 'processing' && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              )}
              {job.status === 'completed' && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              {job.status === 'failed' && (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              {job.status === 'pending' && (
                <Loader2 className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm font-medium">
                {job.status === 'pending' && 'Waiting to start...'}
                {job.status === 'processing' && 'Importing transactions...'}
                {job.status === 'completed' && 'Import completed'}
                {job.status === 'failed' && 'Import failed'}
              </span>
            </div>
            <span className="text-sm text-gray-600">
              {job.progress || 0}%
            </span>
          </div>

          {(job.status === 'processing' || job.status === 'pending') && (
            <Progress value={job.progress || 0} className="h-2" />
          )}

          {job.status === 'processing' && job.totalItems > 0 && (
            <div className="text-xs text-gray-500">
              {job.processedItems || 0} of {job.totalItems} transactions processed
              {job.syncedItems > 0 && ` • ${job.syncedItems} synced`}
              {job.skippedItems > 0 && ` • ${job.skippedItems} skipped`}
              {job.errorItems > 0 && ` • ${job.errorItems} errors`}
            </div>
          )}

          {job.status === 'completed' && (
            <div className="text-sm text-green-700">
              Successfully imported {job.syncedItems || 0} transactions
              {job.skippedItems > 0 && `, skipped ${job.skippedItems} duplicates`}
            </div>
          )}

          {job.status === 'failed' && (
            <Alert variant="destructive">
              <AlertDescription>
                {job.errorMessage || 'An error occurred during import'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      ))}
    </div>
  );
}

