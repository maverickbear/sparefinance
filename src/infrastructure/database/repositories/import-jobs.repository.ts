/**
 * Import Jobs Repository
 * Data access layer for import jobs - only handles database operations
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { BaseImportJob } from "@/src/domain/import-jobs/import-jobs.types";

export interface ImportJobRow {
  id: string;
  user_id: string;
  account_id: string | null;
  type: "plaid_sync" | "csv_import";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  total_items: number;
  processed_items: number;
  synced_items: number;
  skipped_items: number;
  error_items: number;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any> | null;
}

export class ImportJobsRepository {
  /**
   * Find import job by ID
   */
  async findById(jobId: string, userId: string): Promise<ImportJobRow | null> {
    const supabase = await createServerClient();

    const { data: job, error } = await supabase
      .from("system_jobs_imports")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return null;
      }
      logger.error("[ImportJobsRepository] Error finding job:", error);
      throw new Error(`Failed to find job: ${error.message}`);
    }

    return job as ImportJobRow | null;
  }

  /**
   * Find active import jobs for a user (pending or processing)
   */
  async findActiveJobsByUserId(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<ImportJobRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: jobs, error } = await supabase
      .from("system_jobs_imports")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[ImportJobsRepository] Error fetching active jobs:", error);
      return [];
    }

    return (jobs || []) as ImportJobRow[];
  }
}

