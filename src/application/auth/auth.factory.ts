/**
 * Auth Factory
 * Dependency injection factory for AuthService
 */

import { AuthService } from "./auth.service";
import { AuthRepository } from "../../infrastructure/database/repositories/auth.repository";

/**
 * Create an AuthService instance with all dependencies
 */
export function makeAuthService(): AuthService {
  const repository = new AuthRepository();
  return new AuthService(repository);
}

