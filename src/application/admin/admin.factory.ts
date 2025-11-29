/**
 * Admin Factory
 * Dependency injection factory for AdminService
 */

import { AdminService } from "./admin.service";
import { AdminRepository } from "@/src/infrastructure/database/repositories/admin.repository";

/**
 * Create an AdminService instance with all dependencies
 */
export function makeAdminService(): AdminService {
  const repository = new AdminRepository();
  return new AdminService(repository);
}

