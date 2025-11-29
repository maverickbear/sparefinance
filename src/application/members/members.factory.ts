/**
 * Members Factory
 * Dependency injection factory for MembersService
 */

import { MembersService } from "./members.service";
import { MembersRepository } from "@/src/infrastructure/database/repositories/members.repository";

/**
 * Create a MembersService instance with all dependencies
 */
export function makeMembersService(): MembersService {
  const repository = new MembersRepository();
  return new MembersService(repository);
}

