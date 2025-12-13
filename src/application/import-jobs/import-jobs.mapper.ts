/**
 * Import Jobs Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseImportJob } from "../../domain/import-jobs/import-jobs.types";
import { ImportJobRow } from "@/src/infrastructure/database/repositories/import-jobs.repository";

export class ImportJobsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: ImportJobRow): BaseImportJob {
    return {
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      type: row.type,
      status: row.status,
      progress: row.progress,
      totalItems: row.total_items,
      processedItems: row.processed_items,
      syncedItems: row.synced_items,
      skippedItems: row.skipped_items,
      errorItems: row.error_items,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      metadata: row.metadata,
    };
  }
}

