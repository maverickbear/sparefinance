/**
 * Import Jobs Domain Types
 */

export interface BaseImportJob {
  id: string;
  userId: string;
  accountId: string | null;
  type: "plaid_sync" | "csv_import";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  totalItems: number;
  processedItems: number;
  syncedItems: number;
  skippedItems: number;
  errorItems: number;
  errorMessage: string | null;
  retryCount: number;
  nextRetryAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown> | null;
}

