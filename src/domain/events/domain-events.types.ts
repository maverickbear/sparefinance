/**
 * Domain Events Types
 * Pure domain types for domain events
 * No external dependencies
 */

/**
 * Base interface for all domain events
 */
export interface DomainEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}

/**
 * User Created Event
 * Published when a new user is created
 */
export interface UserCreatedEvent extends DomainEvent {
  readonly eventType: 'UserCreated';
  readonly userId: string;
  readonly email: string;
  readonly name: string | null;
}

/**
 * Type guard for UserCreatedEvent
 */
export function isUserCreatedEvent(event: DomainEvent): event is UserCreatedEvent {
  return event.eventType === 'UserCreated';
}

