/**
 * Auth Factory
 * Dependency injection factory for AuthService
 */

import { AuthService } from "./auth.service";
import { AuthRepository } from "@/src/infrastructure/database/repositories/auth.repository";
import { initializeEventHandlers } from "../events/events.factory";

// Initialize event handlers once when module loads
// This ensures handlers are registered before any events are published
initializeEventHandlers();

/**
 * Create an AuthService instance with all dependencies
 */
export function makeAuthService(): AuthService {
  const repository = new AuthRepository();
  return new AuthService(repository);
}

