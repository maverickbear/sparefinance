/**
 * User Created Event Handler
 * Handles UserCreated events by creating personal household
 */

import { UserCreatedEvent, isUserCreatedEvent } from "@/src/domain/events/domain-events.types";
import { logger } from "@/src/infrastructure/utils/logger";
import { DomainEvent } from "@/src/domain/events/domain-events.types";

/**
 * Handle UserCreated event
 * Creates personal household for new user
 */
export async function handleUserCreated(event: DomainEvent): Promise<void> {
  if (!isUserCreatedEvent(event)) {
    return;
  }

  const userCreatedEvent = event as UserCreatedEvent;
  logger.info(`[UserCreatedHandler] Processing UserCreated event for user: ${userCreatedEvent.userId}`);

  try {
    // Import services dynamically to avoid circular dependencies
    const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
    const serviceRoleClient = createServiceRoleClient();
    const householdName = userCreatedEvent.name || "Minha Conta";

    // Call the atomic SQL function to create household, member, and active household
    // Function signature: create_personal_household_atomic(p_user_id uuid, p_household_name text)
    const { data, error } = await serviceRoleClient.rpc("create_personal_household_atomic", {
      p_user_id: userCreatedEvent.userId,
      p_household_name: householdName,
    });

    if (error) {
      logger.error("[UserCreatedHandler] Error calling create_personal_household_atomic:", error);
      throw new Error(`Failed to create personal household: ${error.message}`);
    }

    if (!data) {
      throw new Error("Failed to create personal household: function returned no data");
    }

    logger.info(`[UserCreatedHandler] Personal household created atomically for user ${userCreatedEvent.userId}, household ID: ${data}`);
  } catch (error) {
    logger.error("[UserCreatedHandler] Error handling UserCreated event:", error);
    // Re-throw to allow event bus to handle it
    throw error;
  }
}

