/**
 * Profile Factory
 * Dependency injection factory for ProfileService
 */

import { ProfileService } from "./profile.service";
import { ProfileRepository } from "@/src/infrastructure/database/repositories/profile.repository";

/**
 * Create a ProfileService instance with all dependencies
 */
export function makeProfileService(): ProfileService {
  const repository = new ProfileRepository();
  return new ProfileService(repository);
}

