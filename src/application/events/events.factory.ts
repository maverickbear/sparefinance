/**
 * Events Factory
 * Sets up event handlers and returns event bus
 */

import { eventBus } from "./event-bus";
import { handleUserCreated } from "./user-created.handler";

/**
 * Initialize event handlers
 * Should be called once at application startup
 */
export function initializeEventHandlers(): void {
  // Register UserCreated event handler
  eventBus.subscribe('UserCreated', handleUserCreated);
}

/**
 * Get the event bus instance
 */
export function getEventBus() {
  return eventBus;
}

