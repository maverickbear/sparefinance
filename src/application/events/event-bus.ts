/**
 * Event Bus
 * Simple in-memory event bus for domain events
 * For production, consider using a more robust solution (Redis, RabbitMQ, etc.)
 */

import { DomainEvent } from "@/src/domain/events/domain-events.types";
import { logger } from "@/src/infrastructure/utils/logger";

type EventHandler<T extends DomainEvent> = (event: T) => Promise<void> | void;

class EventBus {
  private handlers: Map<string, EventHandler<DomainEvent>[]> = new Map();

  /**
   * Subscribe to an event type
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler<DomainEvent>);
  }

  /**
   * Publish an event
   * Executes all handlers synchronously
   * For async handlers, errors are caught and logged but don't stop execution
   */
  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];
    
    if (handlers.length === 0) {
      logger.debug(`[EventBus] No handlers registered for event type: ${event.eventType}`);
      return;
    }

    logger.debug(`[EventBus] Publishing event: ${event.eventType} for aggregate: ${event.aggregateId}`);

    // Execute all handlers
    const results = await Promise.allSettled(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          logger.error(`[EventBus] Error in handler for ${event.eventType}:`, error);
          // Don't throw - allow other handlers to execute
        }
      })
    );

    // Log any failures
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn(`[EventBus] ${failures.length} handler(s) failed for event ${event.eventType}`);
    }
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear(): void {
    this.handlers.clear();
  }
}

// Singleton instance
export const eventBus = new EventBus();

