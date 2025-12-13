/**
 * Webhook Events Repository
 * Data access layer for webhook event tracking - only handles database operations
 * No business logic here
 */

import { createServiceRoleClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

export interface WebhookEventRow {
  id: string;
  event_id: string;
  event_type: string;
  processed_at: string;
  result: 'success' | 'error' | 'skipped';
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookEventData {
  eventId: string;
  eventType: string;
  result: 'success' | 'error' | 'skipped';
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class WebhookEventsRepository {
  /**
   * Find webhook event by Stripe event ID
   */
  async findByEventId(eventId: string): Promise<WebhookEventRow | null> {
    const supabase = createServiceRoleClient();

    const { data: event, error } = await supabase
      .from("audit_webhook_events")
      .select("*")
      .eq("event_id", eventId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error("[WebhookEventsRepository] Error fetching webhook event:", error);
      throw new Error(`Failed to fetch webhook event: ${error.message}`);
    }

    return event as WebhookEventRow;
  }

  /**
   * Create a new webhook event record
   */
  async create(data: CreateWebhookEventData): Promise<WebhookEventRow> {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    const { data: event, error } = await supabase
      .from("audit_webhook_events")
      .insert({
        event_id: data.eventId,
        event_type: data.eventType,
        processed_at: now,
        result: data.result,
        error_message: data.errorMessage || null,
        metadata: data.metadata || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[WebhookEventsRepository] Error creating webhook event:", error);
      throw new Error(`Failed to create webhook event: ${error.message}`);
    }

    return event as WebhookEventRow;
  }

  /**
   * Check if event was already processed
   */
  async isProcessed(eventId: string): Promise<boolean> {
    const event = await this.findByEventId(eventId);
    return event !== null && event.result === 'success';
  }
}

