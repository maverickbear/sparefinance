/**
 * Feedback Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseFeedback } from "../../domain/feedback/feedback.types";
import { FeedbackRow } from "@/src/infrastructure/database/repositories/feedback.repository";

export class FeedbackMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: FeedbackRow): BaseFeedback {
    return {
      id: row.id,
      userId: row.user_id,
      rating: row.rating,
      feedback: row.feedback,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

